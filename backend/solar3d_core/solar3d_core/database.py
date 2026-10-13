from pymongo import ASCENDING, MongoClient
from pymongo.database import Database

from solar3d_core.config import settings


class MongoStore:
    """MongoDB boundary. Domain calculations must not depend on database availability."""

    def __init__(self) -> None:
        self._client: MongoClient | None = None

    def connect(self) -> None:
        if self._client is None:
            self._client = MongoClient(
                settings.mongodb_uri,
                serverSelectionTimeoutMS=3000,
                connectTimeoutMS=3000,
                appname="solar3d-core",
            )

    @property
    def database(self) -> Database:
        if self._client is None:
            raise RuntimeError("MongoDB client is not connected")
        return self._client[settings.mongodb_database]

    def ping(self) -> bool:
        try:
            self.connect()
            self.database.command("ping")
            return True
        except Exception:
            return False

    def ensure_indexes(self) -> None:
        db = self.database
        db.projects.create_index(
            [("organizationId", ASCENDING), ("slug", ASCENDING)],
            unique=True,
            name="uq_projects_org_slug",
        )
        db.project_revisions.create_index(
            [("organizationId", ASCENDING), ("projectId", ASCENDING), ("revision", ASCENDING)],
            unique=True,
            name="uq_revision_per_project",
        )
        db.analysis_runs.create_index(
            [("organizationId", ASCENDING), ("projectId", ASCENDING), ("createdAt", ASCENDING)],
            name="ix_analysis_project_timeline",
        )
        db.analysis_runs.create_index(
            [("organizationId", ASCENDING), ("idempotencyKey", ASCENDING)],
            unique=True,
            partialFilterExpression={"idempotencyKey": {"$type": "string"}},
            name="uq_analysis_idempotency",
        )

    def close(self) -> None:
        if self._client is not None:
            self._client.close()
            self._client = None


mongo_store = MongoStore()
