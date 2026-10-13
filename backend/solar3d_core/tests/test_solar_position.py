from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from solar3d_core.models import SolarPositionRequest
from solar3d_core.solar_position import calculate_solar_position


def test_solar_position_is_deterministic_and_vector_is_unit_length():
    request = SolarPositionRequest(
        timestamp=datetime(2024, 6, 21, 19, 0, tzinfo=timezone.utc),
        latitude_deg=39.7392,
        longitude_deg=-104.9903,
    )
    first = calculate_solar_position(request)
    second = calculate_solar_position(request)

    assert first.model_dump() == second.model_dump()
    assert first.solar_elevation_deg > 70
    assert 150 <= first.solar_azimuth_deg <= 210
    vector = first.sun_direction_enu
    norm = (vector.east**2 + vector.north**2 + vector.up**2) ** 0.5
    assert norm == pytest.approx(1.0, abs=1e-12)


def test_solar_position_requires_timezone_aware_timestamp():
    with pytest.raises(ValidationError):
        SolarPositionRequest(
            timestamp=datetime(2024, 6, 21, 19, 0),
            latitude_deg=0,
            longitude_deg=0,
        )


def test_solar_position_rejects_invalid_coordinates():
    with pytest.raises(ValidationError):
        SolarPositionRequest(
            timestamp=datetime(2024, 6, 21, 19, 0, tzinfo=timezone.utc),
            latitude_deg=91,
            longitude_deg=0,
        )
