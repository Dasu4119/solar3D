from shapely.geometry import Polygon, box
from shapely.validation import explain_validity

from solar3d_core.models import (
    LayoutPreviewRequest,
    LayoutPreviewResponse,
    ModulePlacement,
)

ENGINE_VERSION = "layout-0.1.0"


def _polygon(vertices) -> Polygon:
    return Polygon([(point.x_m, point.y_m) for point in vertices])


def preview_layout(request: LayoutPreviewRequest) -> LayoutPreviewResponse:
    """Create a transparent grid-based layout preview on a single roof-local plane.

    This is a deterministic first-release layout heuristic, not a structural or
    permit-ready design. Roof-local coordinates are metres; roof planes must be
    normalized by an import adapter before this function is called.
    """
    roof = _polygon(request.roof.vertices)
    if not roof.is_valid:
        raise ValueError(f"invalid roof polygon: {explain_validity(roof)}")
    if roof.area <= 0:
        raise ValueError("roof polygon must have positive area")

    obstacles = [_polygon(item.vertices) for item in request.obstacles]
    for index, obstacle in enumerate(obstacles):
        if not obstacle.is_valid or obstacle.area <= 0:
            raise ValueError(f"invalid obstacle polygon at index {index}")

    usable = roof.buffer(-request.setback_m, join_style="mitre")
    if usable.is_empty or usable.area <= 0:
        return LayoutPreviewResponse(
            engine_version=ENGINE_VERSION,
            module_count=0,
            placements=[],
            rejected_candidate_count=0,
            warnings=["Setback leaves no usable roof area."],
        )

    exclusion = None
    for obstacle in obstacles:
        exclusion = obstacle if exclusion is None else exclusion.union(obstacle)
    if exclusion is not None:
        usable = usable.difference(exclusion.buffer(request.module.gap_m / 2))

    width = request.module.width_m
    height = request.module.height_m
    if request.module.orientation == "landscape":
        width, height = height, width

    step_x = width + request.module.gap_m
    step_y = height + request.module.gap_m
    min_x, min_y, max_x, max_y = usable.bounds
    placements: list[ModulePlacement] = []
    rejected = 0

    # Stable origin and ordering make identical inputs produce identical outputs.
    y = min_y
    while y + height <= max_y + 1e-9:
        x = min_x
        while x + width <= max_x + 1e-9:
            candidate = box(x, y, x + width, y + height)
            if usable.covers(candidate):
                placements.append(ModulePlacement(
                    x_m=round(x, 6),
                    y_m=round(y, 6),
                    width_m=width,
                    height_m=height,
                    rotation_deg=0 if request.module.orientation == "portrait" else 90,
                ))
            else:
                rejected += 1
            x += step_x
        y += step_y

    warnings = [
        "Preview uses a roof-local planar grid; no roof pitch, structural loading, fire-code, wind-load, or electrical constraints are evaluated.",
        "Obstacle and setback boundaries are geometric only; verify site-specific installation rules before construction.",
    ]
    return LayoutPreviewResponse(
        engine_version=ENGINE_VERSION,
        module_count=len(placements),
        placements=placements,
        rejected_candidate_count=rejected,
        warnings=warnings,
    )
