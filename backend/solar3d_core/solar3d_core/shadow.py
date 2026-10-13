"""Deterministic sampled geometric shadow analysis for triangular occluder meshes."""
from math import sqrt

from solar3d_core.models import (
    ShadowAnalysisRequest,
    ShadowAnalysisResponse,
    SolarPositionRequest,
    SurfaceShadowResult,
)
from solar3d_core.solar_position import calculate_solar_position

SHADOW_MODEL_VERSION = "sampled-ray-triangle-v1"
RAY_EPSILON_M = 1e-6
INTERSECTION_EPSILON = 1e-10

Vec3 = tuple[float, float, float]


def _sub(a: Vec3, b: Vec3) -> Vec3:
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def _add_scaled(a: Vec3, b: Vec3, scale: float) -> Vec3:
    return (a[0] + b[0] * scale, a[1] + b[1] * scale, a[2] + b[2] * scale)


def _dot(a: Vec3, b: Vec3) -> float:
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def _cross(a: Vec3, b: Vec3) -> Vec3:
    return (
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    )


def _as_vec(point) -> Vec3:
    return (point.x_m, point.y_m, point.z_m)


def _ray_intersects_triangle(
    origin: Vec3, direction: Vec3, triangle: tuple[Vec3, Vec3, Vec3]
) -> bool:
    """Two-sided Möller–Trumbore ray/triangle test; direction need not be unit."""
    a, b, c = triangle
    edge1 = _sub(b, a)
    edge2 = _sub(c, a)
    h = _cross(direction, edge2)
    determinant = _dot(edge1, h)
    if abs(determinant) < INTERSECTION_EPSILON:
        return False

    inverse = 1.0 / determinant
    s = _sub(origin, a)
    u = inverse * _dot(s, h)
    if u < -INTERSECTION_EPSILON or u > 1.0 + INTERSECTION_EPSILON:
        return False

    q = _cross(s, edge1)
    v = inverse * _dot(direction, q)
    if v < -INTERSECTION_EPSILON or u + v > 1.0 + INTERSECTION_EPSILON:
        return False

    distance = inverse * _dot(edge2, q)
    return distance > RAY_EPSILON_M


def _sample_quad(corners: tuple[Vec3, Vec3, Vec3, Vec3], u: float, v: float) -> Vec3:
    """Bilinearly interpolate corners ordered p00, p10, p11, p01."""
    p00, p10, p11, p01 = corners
    return (
        (1-u)*(1-v)*p00[0] + u*(1-v)*p10[0] + u*v*p11[0] + (1-u)*v*p01[0],
        (1-u)*(1-v)*p00[1] + u*(1-v)*p10[1] + u*v*p11[1] + (1-u)*v*p01[1],
        (1-u)*(1-v)*p00[2] + u*(1-v)*p10[2] + u*v*p11[2] + (1-u)*v*p01[2],
    )


def _triangle_is_degenerate(triangle: tuple[Vec3, Vec3, Vec3]) -> bool:
    a, b, c = triangle
    cross = _cross(_sub(b, a), _sub(c, a))
    return sqrt(_dot(cross, cross)) < 1e-9


def analyze_instantaneous_shadows(request: ShadowAnalysisRequest) -> ShadowAnalysisResponse:
    """Estimate geometric shaded sample fraction for each target quad.

    This is a deterministic geometric diagnostic, not an irradiance or energy-loss
    model. Occluder triangles must be in the same east/north/up metre coordinate
    frame as the target surfaces and must not include the target surface itself.
    """
    solar = calculate_solar_position(SolarPositionRequest(
        timestamp=request.timestamp,
        latitude_deg=request.latitude_deg,
        longitude_deg=request.longitude_deg,
    ))
    warnings = [
        "Result is a sampled geometric shade fraction, not irradiance loss, electrical mismatch loss, or energy loss.",
        "Coordinates must be metres in a common east/north/up frame aligned to true north; import transforms are not applied here.",
        "Occluder mesh must exclude the target module surfaces. This endpoint is synchronous and intended for bounded previews.",
    ]

    if solar.solar_elevation_deg <= 0:
        warnings.append("Sun is at or below the geometric horizon; direct-beam shadow fraction is undefined.")
        return ShadowAnalysisResponse(
            model_version=SHADOW_MODEL_VERSION,
            solar_position=solar,
            surface_results=[
                SurfaceShadowResult(
                    surface_id=surface.surface_id,
                    shaded_sample_count=0,
                    total_sample_count=0,
                    sampled_shaded_fraction=None,
                )
                for surface in request.target_surfaces
            ],
            warnings=warnings,
        )

    sun = solar.sun_direction_enu
    direction: Vec3 = (sun.east, sun.north, sun.up)
    triangles = [
        (_as_vec(triangle.a), _as_vec(triangle.b), _as_vec(triangle.c))
        for triangle in request.occluder_triangles
    ]
    for index, triangle in enumerate(triangles):
        if _triangle_is_degenerate(triangle):
            raise ValueError(f"occluder triangle at index {index} is degenerate")

    results: list[SurfaceShadowResult] = []
    for surface in request.target_surfaces:
        corners = tuple(_as_vec(point) for point in surface.corners)
        shaded = 0
        total = request.samples_u * request.samples_v
        for row in range(request.samples_v):
            v = (row + 0.5) / request.samples_v
            for column in range(request.samples_u):
                u = (column + 0.5) / request.samples_u
                point = _sample_quad(corners, u, v)
                origin = _add_scaled(point, direction, RAY_EPSILON_M)
                is_shaded = any(
                    _ray_intersects_triangle(origin, direction, triangle)
                    for triangle in triangles
                )
                shaded += int(is_shaded)

        results.append(SurfaceShadowResult(
            surface_id=surface.surface_id,
            shaded_sample_count=shaded,
            total_sample_count=total,
            sampled_shaded_fraction=shaded / total,
        ))

    return ShadowAnalysisResponse(
        model_version=SHADOW_MODEL_VERSION,
        solar_position=solar,
        surface_results=results,
        warnings=warnings,
    )
