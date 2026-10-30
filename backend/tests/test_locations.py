def test_create_and_get_location(client):
    """Test creating a location and retrieving it by ID."""
    payload = {
        "name": "Barapani Hill Tract",
        "state": "Meghalaya",
        "district": "Ri-Bhoi",
        "latitude": 25.6500,
        "longitude": 91.9000,
        "elevation": 980.0,
        "slope_angle": 32.5,
        "is_active": True,
    }
    response = client.post("/api/v1/locations", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Barapani Hill Tract"
    assert data["state"] == "Meghalaya"
    assert data["district"] == "Ri-Bhoi"
    assert "id" in data
    loc_id = data["id"]

    # Retrieve by ID
    get_res = client.get(f"/api/v1/locations/{loc_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == loc_id


def test_duplicate_location_conflict(client):
    """Test duplicate registration returns 409 Conflict."""
    payload = {
        "name": "Guwahati Ridge Area",
        "state": "Assam",
        "district": "Kamrup",
        "latitude": 26.1500,
        "longitude": 91.7500,
    }
    res1 = client.post("/api/v1/locations", json=payload)
    assert res1.status_code == 201

    res2 = client.post("/api/v1/locations", json=payload)
    assert res2.status_code == 409
    assert "already registered" in res2.json()["detail"]


def test_invalid_coordinates_validation(client):
    """Test out-of-range coordinates return 422 Unprocessable Entity."""
    payload = {
        "name": "Invalid Coord Hill",
        "state": "Assam",
        "district": "Kamrup",
        "latitude": 95.0,  # Invalid: > 90
        "longitude": 91.7500,
    }
    res = client.post("/api/v1/locations", json=payload)
    assert res.status_code == 422


def test_location_pagination_and_filter(client):
    """Test listing locations with pagination and district filter."""
    for i in range(5):
        client.post(
            "/api/v1/locations",
            json={
                "name": f"Hillslope Sector {i}",
                "state": "Assam" if i % 2 == 0 else "Meghalaya",
                "district": "East Khasi" if i % 2 != 0 else "Kamrup",
                "latitude": 25.0 + (i * 0.1),
                "longitude": 91.0 + (i * 0.1),
            },
        )

    # Filter by state
    res = client.get("/api/v1/locations?state=Meghalaya&page=1&size=10")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2
    for item in data["items"]:
        assert item["state"] == "Meghalaya"


def test_update_and_delete_location(client):
    """Test updating and deleting a monitored location."""
    res = client.post(
        "/api/v1/locations",
        json={
            "name": "Temporary Test Hill",
            "state": "Nagaland",
            "district": "Kohima",
            "latitude": 25.6700,
            "longitude": 94.1000,
        },
    )
    assert res.status_code == 201
    loc_id = res.json()["id"]

    # Patch update
    patch_res = client.patch(
        f"/api/v1/locations/{loc_id}",
        json={"slope_angle": 41.5, "is_active": False},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["slope_angle"] == 41.5
    assert patch_res.json()["is_active"] is False

    # Delete
    del_res = client.delete(f"/api/v1/locations/{loc_id}")
    assert del_res.status_code == 204

    # Verify not found
    get_res = client.get(f"/api/v1/locations/{loc_id}")
    assert get_res.status_code == 404
