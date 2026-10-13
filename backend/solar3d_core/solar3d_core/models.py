from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", validate_assignment=True)


class Point2D(StrictModel):
    x_m: float = Field(ge=-1_000_000, le=1_000_000)
    y_m: float = Field(ge=-1_000_000, le=1_000_000)


class Polygon2D(StrictModel):
    """Polygon in a roof-local 2D coordinate system; coordinates are in metres."""
    vertices: list[Point2D] = Field(min_length=3, max_length=100_000)

    @field_validator("vertices")
    @classmethod
    def at_least_three_distinct_points(cls, value: list[Point2D]) -> list[Point2D]:
        unique = {(point.x_m, point.y_m) for point in value}
        if len(unique) < 3:
            raise ValueError("polygon must contain at least three distinct points")
        return value


class ModuleSpec(StrictModel):
    sku: str = Field(min_length=1, max_length=100)
    width_m: float = Field(gt=0, le=5)
    height_m: float = Field(gt=0, le=5)
    gap_m: float = Field(default=0.02, ge=0, le=1)
    orientation: Literal["portrait", "landscape"] = "portrait"


class LayoutPreviewRequest(StrictModel):
    roof: Polygon2D
    obstacles: list[Polygon2D] = Field(default_factory=list, max_length=10_000)
    module: ModuleSpec
    setback_m: float = Field(default=0.3, ge=0, le=20)
    organization_id: str = Field(min_length=1, max_length=128)
    project_id: str = Field(min_length=1, max_length=128)


class ModulePlacement(StrictModel):
    x_m: float
    y_m: float
    width_m: float
    height_m: float
    rotation_deg: Literal[0, 90]


class LayoutPreviewResponse(StrictModel):
    engine_version: str
    coordinate_system: Literal["roof_local_xy_m"] = "roof_local_xy_m"
    module_count: int
    placements: list[ModulePlacement]
    rejected_candidate_count: int
    warnings: list[str]
