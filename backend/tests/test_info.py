def test_info_endpoint(client):
    """Test GET /api/v1/info returns 200 and application metadata."""
    response = client.get("/api/v1/info")
    assert response.status_code == 200
    data = response.json()
    assert data["application"] == "LandslideGuard AI"
    assert "subtitle" in data
    assert "current_phase" in data
    assert "target_region" in data
    assert "status" in data
    # Ensure no secrets or configuration paths are leaked
    for forbidden_key in ["password", "secret", "token", "database_url", "key"]:
        assert forbidden_key not in data
