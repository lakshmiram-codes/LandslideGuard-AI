from unittest.mock import patch


def test_database_health_endpoint_healthy(client):
    """Test /api/v1/health/db returns 200 when database is connected."""
    response = client.get("/api/v1/health/db")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["database_status"] == "connected"
    assert data["database_available"] is True
    assert "dialect" in data


def test_database_health_endpoint_unavailable(client):
    """Test /api/v1/health/db returns 503 Service Unavailable when DB fails."""
    with patch("app.api.v1.endpoints.health.check_db_health") as mock_check:
        mock_check.return_value = {
            "status": "unavailable",
            "dialect": "postgresql",
            "database_available": False,
            "error": "Simulated connection timeout to database.",
        }
        response = client.get("/api/v1/health/db")
        assert response.status_code == 503
        data = response.json()
        assert data["status"] == "degraded"
        assert data["database_status"] == "unavailable"
        assert data["database_available"] is False
        assert "Simulated connection timeout" in data["details"]


def test_existing_health_check_preserved(client):
    """Verify original Phase 1 & 2 /api/v1/health contract remains identical."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["application"] == "LandslideGuard AI"
    assert "version" in data
    assert "timestamp" in data
