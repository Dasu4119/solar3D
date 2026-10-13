import pytest

from solar3d_core.layout import preview_layout
from solar3d_core.models import LayoutPreviewRequest


def square_roof_request(**overrides):
    data = {
        "organization_id": "org-test",
        "project_id": "project-test",
        "roof": {"vertices": [
            {"x_m": 0, "y_m": 0},
            {"x_m": 10, "y_m": 0},
            {"x_m": 10, "y_m": 10},
            {"x_m": 0, "y_m": 10},
        ]},
        "module": {"sku": "TEST-400", "width_m": 1, "height_m": 2, "gap_m": 0.1},
        "setback_m": 0.5,
        "obstacles": [],
    }
    data.update(overrides)
    return LayoutPreviewRequest.model_validate(data)


def test_layout_is_deterministic():
    request = square_roof_request()
    first = preview_layout(request)
    second = preview_layout(request)
    assert first.model_dump() == second.model_dump()
    assert first.module_count > 0


def test_layout_respects_roof_setback():
    result = preview_layout(square_roof_request(setback_m=1.0))
    assert all(p.x_m >= 1.0 - 1e-6 for p in result.placements)
    assert all(p.y_m >= 1.0 - 1e-6 for p in result.placements)
    assert all(p.x_m + p.width_m <= 9.0 + 1e-6 for p in result.placements)
    assert all(p.y_m + p.height_m <= 9.0 + 1e-6 for p in result.placements)


def test_obstacle_excludes_panel_placements():
    request = square_roof_request(obstacles=[{"vertices": [
        {"x_m": 4, "y_m": 4}, {"x_m": 6, "y_m": 4},
        {"x_m": 6, "y_m": 6}, {"x_m": 4, "y_m": 6},
    ]}])
    result = preview_layout(request)
    from shapely.geometry import box
    obstacle = box(3.95, 3.95, 6.05, 6.05)
    assert all(not obstacle.intersects(box(p.x_m, p.y_m, p.x_m+p.width_m, p.y_m+p.height_m)) for p in result.placements)


def test_invalid_self_intersecting_roof_is_rejected():
    request = square_roof_request(roof={"vertices": [
        {"x_m": 0, "y_m": 0}, {"x_m": 10, "y_m": 10},
        {"x_m": 0, "y_m": 10}, {"x_m": 10, "y_m": 0},
    ]})
    with pytest.raises(ValueError, match="invalid roof polygon"):
        preview_layout(request)
