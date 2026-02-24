"""
Shared networks API — publish, view, update, and delete bike-share network designs.

Ownership model:
  - The client generates a 256-bit random secret and sends its SHA-256 hash
    as ``owner_token_hash`` on creation.
  - The server stores only the hash.  To modify or delete, the client sends
    the raw secret in the ``X-Owner-Token`` header; the server hashes it and
    compares.
  - Read access requires only the UUID (unguessable, 128-bit).

Schema versioning:
  - The ``data`` JSONB payload contains a ``_schema_version`` key.
  - On every read the server runs ``_migrate()`` to bring old payloads up to
    the current version — no batch SQL migrations needed.
"""

from __future__ import annotations

import hashlib
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel, Field

from src.config import settings
from src.data.db import get_conn, get_pool

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/networks", tags=["networks"])

# ---------------------------------------------------------------------------
# Schema migration (JSONB payload versioning)
# ---------------------------------------------------------------------------

CURRENT_SCHEMA_VERSION = 1


def _migrate(data: dict) -> dict:
    """Bring a stored network payload up to the current schema version.

    Each ``if v < N`` block migrates from version N-1 → N.  Add new blocks
    at the bottom when the SavedNetwork shape changes.
    """
    v = data.get("_schema_version", 1)

    # -- future migrations go here --
    # if v < 2:
    #     data.setdefault("someNewField", default_value)

    data["_schema_version"] = CURRENT_SCHEMA_VERSION
    return data


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def _verify_owner(stored_hash: str, raw_token: str | None) -> None:
    """Raise 403 if the raw token doesn't match the stored hash."""
    if not raw_token:
        raise HTTPException(403, "Missing X-Owner-Token header")
    if _hash_token(raw_token) != stored_hash:
        raise HTTPException(403, "Invalid owner token")


def _check_db() -> None:
    if get_pool() is None:
        raise HTTPException(503, "Network sharing is not available (database not configured)")


# ---------------------------------------------------------------------------
# Request / response schemas
# ---------------------------------------------------------------------------


class ShareRequest(BaseModel):
    owner_token_hash: str = Field(..., min_length=64, max_length=64)
    name: str = Field(..., min_length=1, max_length=200)
    description: str = Field("", max_length=2000)
    author: str = Field("", max_length=100)
    data: dict = Field(...)


class UpdateRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = Field(None, max_length=2000)
    author: str | None = Field(None, max_length=100)
    data: dict | None = None


class SharedNetworkResponse(BaseModel):
    id: str
    name: str
    description: str
    author: str
    station_count: int
    data: dict
    created_at: str
    updated_at: str
    view_count: int


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("")
def share_network(req: ShareRequest, request: Request):
    """Publish a saved network.  Returns the server-assigned UUID."""
    _check_db()

    payload_bytes = json.dumps(req.data, separators=(",", ":")).encode()
    if len(payload_bytes) > settings.max_network_payload_kb * 1024:
        raise HTTPException(
            413,
            f"Network payload too large ({len(payload_bytes) // 1024} KB, "
            f"max {settings.max_network_payload_kb} KB)",
        )

    stations = req.data.get("stations", [])
    if len(stations) > settings.max_existing_stations:
        raise HTTPException(
            422,
            f"Too many stations ({len(stations)}, max {settings.max_existing_stations})",
        )

    data = dict(req.data)
    data["_schema_version"] = CURRENT_SCHEMA_VERSION

    network_id = str(uuid.uuid4())

    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO shared_networks
                   (id, owner_token, name, description, author, station_count, data)
            VALUES (%(id)s, %(owner_token)s, %(name)s, %(description)s,
                    %(author)s, %(station_count)s, %(data)s::jsonb)
            """,
            {
                "id": network_id,
                "owner_token": req.owner_token_hash,
                "name": req.name,
                "description": req.description,
                "author": req.author,
                "station_count": len(stations),
                "data": json.dumps(data),
            },
        )

    log.info("Network shared: %s (%d stations)", network_id, len(stations))

    return {"id": network_id, "name": req.name, "station_count": len(stations)}


@router.get("/{network_id}")
def get_network(network_id: str, request: Request):
    """Retrieve a shared network by UUID (public, read-only)."""
    _check_db()

    try:
        uuid.UUID(network_id)
    except ValueError:
        raise HTTPException(400, "Invalid network ID")

    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM shared_networks WHERE id = %s", (network_id,)
        ).fetchone()

        if not row:
            raise HTTPException(404, "Network not found")

        conn.execute(
            "UPDATE shared_networks SET view_count = view_count + 1 WHERE id = %s",
            (network_id,),
        )

    data = _migrate(row["data"])

    return SharedNetworkResponse(
        id=str(row["id"]),
        name=row["name"],
        description=row["description"],
        author=row["author"],
        station_count=row["station_count"],
        data=data,
        created_at=row["created_at"].isoformat(),
        updated_at=row["updated_at"].isoformat(),
        view_count=row["view_count"] + 1,
    )


@router.put("/{network_id}")
def update_network(
    network_id: str,
    req: UpdateRequest,
    x_owner_token: str | None = Header(None),
):
    """Update a shared network (requires owner token)."""
    _check_db()

    try:
        uuid.UUID(network_id)
    except ValueError:
        raise HTTPException(400, "Invalid network ID")

    with get_conn() as conn:
        row = conn.execute(
            "SELECT owner_token FROM shared_networks WHERE id = %s",
            (network_id,),
        ).fetchone()

        if not row:
            raise HTTPException(404, "Network not found")

        _verify_owner(row["owner_token"], x_owner_token)

        # Build SET clause dynamically from provided fields
        updates: dict[str, Any] = {"updated_at": datetime.now(timezone.utc)}

        if req.name is not None:
            updates["name"] = req.name
        if req.description is not None:
            updates["description"] = req.description
        if req.author is not None:
            updates["author"] = req.author

        if req.data is not None:
            payload_bytes = json.dumps(req.data, separators=(",", ":")).encode()
            if len(payload_bytes) > settings.max_network_payload_kb * 1024:
                raise HTTPException(413, "Network payload too large")

            data = dict(req.data)
            data["_schema_version"] = CURRENT_SCHEMA_VERSION
            updates["data"] = json.dumps(data)
            updates["station_count"] = len(req.data.get("stations", []))

        set_parts = []
        params: dict[str, Any] = {"id": network_id}
        for key, val in updates.items():
            param_name = f"p_{key}"
            if key == "data":
                set_parts.append(f"{key} = %({param_name})s::jsonb")
            else:
                set_parts.append(f"{key} = %({param_name})s")
            params[param_name] = val

        conn.execute(
            f"UPDATE shared_networks SET {', '.join(set_parts)} WHERE id = %(id)s",
            params,
        )

    return {"status": "ok", "id": network_id}


@router.delete("/{network_id}")
def delete_network(
    network_id: str,
    x_owner_token: str | None = Header(None),
):
    """Delete a shared network (requires owner token)."""
    _check_db()

    try:
        uuid.UUID(network_id)
    except ValueError:
        raise HTTPException(400, "Invalid network ID")

    with get_conn() as conn:
        row = conn.execute(
            "SELECT owner_token FROM shared_networks WHERE id = %s",
            (network_id,),
        ).fetchone()

        if not row:
            raise HTTPException(404, "Network not found")

        _verify_owner(row["owner_token"], x_owner_token)

        conn.execute("DELETE FROM shared_networks WHERE id = %s", (network_id,))

    log.info("Network deleted: %s", network_id)
    return {"status": "ok", "id": network_id}
