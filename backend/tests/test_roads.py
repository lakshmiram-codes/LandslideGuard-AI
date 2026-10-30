def test_create_and_get_road(client):
    """Test registering a road corridor and retrieving it."""
    payload = {
        "road_name": "NH-10 Sevoke-Gangtok Highway",
        "state": "Sikkim",
        "district": "East Sikkim",
        "connectivity_status": "restricted",
        "status_description": "Single lane open near 29th Mile due to rock clearing.",
        "latitude": 27.1500,
        "longitude": 88.4800,
    }
    res = client.post("/api/v1/roads", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["road_name"] == "NH-10 Sevoke-Gangtok Highway"
    assert data["connectivity_status"] == "restricted"
    road_id = data["id"]

    # Get by ID
    get_res = client.get(f"/api/v1/roads/{road_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == road_id


def test_list_roads_with_status_filter(client):
    """Test listing road corridors with connectivity_status filter."""
    client.post(
        "/api/v1/roads",
        json={
            "road_name": "NH-27 Guwahati Bypass",
            "state": "Assam",
            "district": "Kamrup",
            "connectivity_status": "open",
        },
    )
    client.post(
        "/api/v1/roads",
        json={
            "road_name": "State Highway 12 Hill Pass",
            "state": "Meghalaya",
            "district": "West Khasi Hills",
            "connectivity_status": "blocked",
        },
    )

    res_open = client.get("/api/v1/roads?connectivity_status=open")
    assert res_open.status_code == 200
    assert any(r["connectivity_status"] == "open" for r in res_open.json()["items"])

    res_blocked = client.get("/api/v1/roads?connectivity_status=blocked")
    assert res_blocked.status_code == 200
    assert any(r["connectivity_status"] == "blocked" for r in res_blocked.json()["items"])


def test_road_not_found(client):
    """Test querying non-existent road ID returns 404."""
    res = client.get("/api/v1/roads/999999")
    assert res.status_code == 404
