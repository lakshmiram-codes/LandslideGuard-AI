def test_health_endpoint(client):
    """Test GET /api/v1/health returns 200 and healthy status."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["application"] == "LandslideGuard AI"
    assert "version" in data
    assert "timestamp" in data
