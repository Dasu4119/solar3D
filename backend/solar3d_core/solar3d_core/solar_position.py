"""Solar-position adapter backed by pvlib's NREL SPA implementation."""
from math import cos, radians, sin
from datetime import timezone

import pandas as pd
import pvlib

from solar3d_core.models import SolarPositionRequest, SolarPositionResponse

SOLAR_POSITION_MODEL_VERSION = "pvlib-nrel_numpy-v1"


def calculate_solar_position(request: SolarPositionRequest) -> SolarPositionResponse:
    """Calculate geometric solar position and an ENU unit vector toward the sun.

    Coordinate convention: x=east, y=north, z=up. Azimuth is degrees clockwise
    from true north. The input timestamp must carry an explicit UTC offset.
    """
    timestamp_utc = request.timestamp.astimezone(timezone.utc)
    times = pd.DatetimeIndex([pd.Timestamp(timestamp_utc)])
    result = pvlib.solarposition.get_solarposition(
        time=times,
        latitude=request.latitude_deg,
        longitude=request.longitude_deg,
        method="nrel_numpy",
    )
    zenith = float(result["zenith"].iloc[0])
    azimuth = float(result["azimuth"].iloc[0])
    elevation = 90.0 - zenith

    azimuth_rad = radians(azimuth)
    elevation_rad = radians(elevation)
    east = cos(elevation_rad) * sin(azimuth_rad)
    north = cos(elevation_rad) * cos(azimuth_rad)
    up = sin(elevation_rad)

    # Normalize against small floating-point drift; the vector points from the
    # target surface toward the sun, not in the incoming photon direction.
    norm = (east * east + north * north + up * up) ** 0.5
    vector = {"east": east / norm, "north": north / norm, "up": up / norm}

    return SolarPositionResponse(
        model_version=SOLAR_POSITION_MODEL_VERSION,
        timestamp_utc=timestamp_utc,
        latitude_deg=request.latitude_deg,
        longitude_deg=request.longitude_deg,
        solar_zenith_deg=zenith,
        solar_azimuth_deg=azimuth,
        solar_elevation_deg=elevation,
        sun_direction_enu=vector,
    )
