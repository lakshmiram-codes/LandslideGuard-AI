def test_create_and_update_incident(client):
    """Test incident reporting workflow and review status update."""
    payload = {
        "category": "slope_cracks",
        "description": "Noticeable 2cm surface crack opening along road bank.",
        "latitude": 27.3400,
        "longitude": 88.6100,
        "source_type": "citizen",
    }
    res = client.post("/api/v1/incidents", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["category"] == "slope_cracks"
    assert data["review_status"] == "pending_review"
    incident_id = data["id"]

    # Patch review status to verified
    patch_res = client.patch(
        f"/api/v1/incidents/{incident_id}",
        json={"review_status": "verified"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["review_status"] == "verified"


def test_incident_invalid_location(client):
    """Test creating incident with non-existent location ID returns 404."""
    payload = {
        "category": "road_blockage",
        "description": "Debris across both lanes.",
        "latitude": 25.5000,
        "longitude": 91.8000,
        "location_id": 999999,
        "source_type": "patrol",
    }
    res = client.post("/api/v1/incidents", json=payload)
    assert res.status_code == 404
    assert "does not exist" in res.json()["detail"]


def test_incident_filtering_by_status(client):
    """Test filtering incidents by review_status."""
    client.post(
        "/api/v1/incidents",
        json={
            "category": "debris_flow",
            "description": "Minor scree slide on shoulder.",
            "latitude": 26.0,
            "longitude": 91.0,
            "source_type": "field_observer",
        },
    )
    res = client.get("/api/v1/incidents?review_status=pending_review")
    assert res.status_code == 200
    assert res.json()["total"] >= 1


def test_incident_invalid_category(client):
    """Test invalid category value returns 422."""
    payload = {
        "category": "alien_invasion",  # Invalid enum
        "description": "Unrecognized category test.",
        "latitude": 26.0,
        "longitude": 91.0,
        "source_type": "citizen",
    }
    res = client.post("/api/v1/incidents", json=payload)
    assert res.status_code == 422
