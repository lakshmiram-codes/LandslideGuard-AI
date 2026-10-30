def test_root_endpoint(client):
    """Test GET / returns 200 and expected schema fields."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["application"] == "LandslideGuard AI"
    assert data["status"] == "running"
    assert "version" in data
    assert "phase" in data
    assert "docs_url" in data
