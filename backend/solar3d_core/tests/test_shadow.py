from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from solar3d_core.models import ShadowAnalysisRequest
from solar3d_core.shadow import analyze_instantaneous_shadows


def point(x, y, z):
    return {"x_m": x, "y_m": y, "z_m": z}


def target_surface():
    return {
        "surface_id": "module-1",
        "corners": [
            point(0, 0, 0), point(1, 0, 0),
            point(1, 1, 0), point(0, 1, 0),
        ],
    }


def request(occluders):
    return ShadowAnalysisRequest(
        timestamp=datetime(2024, 6, 21, 19, 0, tzinfo=timezone.utc),
        latitude_deg=39.7392,
        longitude_deg=-104.9903,
        target_surfaces=[target_surface()],
        occluder_triangles=occluders,
        samples_u=4,
        samples_v=4,
    )


def test_no_occluders_means_no_geometric_shade():
    result = analyze_instantaneous_shadows(request([]))
    assert result.surface_results[0].sampled_shaded_fraction == 0.0
    assert result.surface_results[0].total_sample_count == 16


def test_vertical_wall_shades_half_the_samples_for_eastward_rays():
    # Two triangles form a wall at x=0.5. The test uses the low-level ray helper
    # with a deterministic eastward/upward direction to isolate geometry math.
    from solar3d_core.shadow import _ray_intersects_triangle, _sample_quad

    corners = ((0, 0, 0), (1, 0, 0), (1, 1, 0), (0, 1, 0))
    wall = [
        ((0.5, 0, 0), (0.5, 1, 0), (0.5, 1, 1)),
        ((0.5, 0, 0), (0.5, 1, 1), (0.5, 0, 1)),
    ]
    direction = (1.0, 0.0, 0.2)
    shaded = 0
    total = 0
    for row in range(4):
        for column in range(4):
            sample = _sample_quad(corners, (column + .5)/4, (row + .5)/4)
            total += 1
            shaded += int(any(_ray_intersects_triangle(sample, direction, tri) for tri in wall))
    assert shaded / total == pytest.approx(0.5)


def test_degenerate_occluder_triangle_is_rejected():
    degenerate = {
        "a": point(1, 1, 1),
        "b": point(1, 1, 1),
        "c": point(2, 2, 2),
    }
    with pytest.raises(ValueError, match="degenerate"):
        analyze_instantaneous_shadows(request([degenerate]))


def test_naive_oversized_sampling_is_rejected_at_schema_boundary():
    with pytest.raises(ValidationError):
        ShadowAnalysisRequest(
            timestamp=datetime(2024, 6, 21, 19, 0, tzinfo=timezone.utc),
            latitude_deg=39.7,
            longitude_deg=-105,
            target_surfaces=[target_surface()],
            occluder_triangles=[],
            samples_u=11,
            samples_v=5,
        )
