from datetime import datetime, timezone
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from abc import ABC, abstractmethod


@dataclass
class ProviderObservation:
    """Normalized observation payload produced by a weather provider."""
    metric_type: str  # e.g., 'rainfall', 'temperature', 'relative_humidity', 'soil_moisture', 'surface_pressure'
    value: float
    unit: str
    observed_at: datetime  # Timezone-aware UTC timestamp
    is_forecast: bool = False
    source: str = ""
    provenance_metadata: Optional[str] = None
    raw_metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ProviderFetchResult:
    """Aggregate result from a provider query for a specific geographic coordinate."""
    success: bool
    provider_name: str
    latitude: float
    longitude: float
    observations: List[ProviderObservation] = field(default_factory=list)
    retrieved_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    error_message: Optional[str] = None
    http_status: Optional[int] = None
    is_live_call: bool = True


class BaseWeatherProvider(ABC):
    """Abstract interface for external weather telemetry providers."""

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Name of the weather data provider."""
        pass

    @property
    @abstractmethod
    def documentation_url(self) -> str:
        """Official documentation reference URL."""
        pass

    @property
    @abstractmethod
    def attribution_text(self) -> str:
        """Legal attribution notice."""
        pass

    @abstractmethod
    def fetch_weather(
        self,
        latitude: float,
        longitude: float,
        elevation: Optional[float] = None,
    ) -> ProviderFetchResult:
        """Fetch current/recent analysis weather observations for geographic coordinates."""
        pass

    @abstractmethod
    def health_check(self) -> Dict[str, Any]:
        """Perform a lightweight diagnostic health ping against the provider."""
        pass
