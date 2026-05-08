"""Backend API regression tests for the Cloud Inventory Management System.

Covers:
  - /api/health
  - /api/products CRUD (+ SKU uniqueness, 404, validation)
  - /api/sales (stock decrement, insufficient stock, invalid product)
  - /api/insights (low-stock, per-product, AI summary, daily AI summary)
  - /api prefix enforcement
"""
import os
import time
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    # Fallback for when frontend .env is not in this process's environment.
    # Read it directly from the .env file.
    from pathlib import Path
    env_file = Path("/app/frontend/.env")
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().strip('"').strip("'")
                break

assert BASE_URL, "REACT_APP_BACKEND_URL is required to run these tests."
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
def client() -> requests.Session:
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture
def unique_sku() -> str:
    return f"TEST-{uuid.uuid4().hex[:8].upper()}"


@pytest.fixture
def created_product(client, unique_sku):
    """Create a product for a single test; cleanup afterwards."""
    payload = {
        "name": "TEST_Widget",
        "sku": unique_sku,
        "category": "Testing",
        "stock_qty": 50,
        "reorder_threshold": 10,
    }
    r = client.post(f"{API}/products", json=payload)
    assert r.status_code == 201, r.text
    product = r.json()
    yield product
    client.delete(f"{API}/products/{product['id']}")


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
class TestHealth:
    def test_health_ok(self, client):
        r = client.get(f"{API}/health")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "ok"
        assert data["database"] is True


# ---------------------------------------------------------------------------
# Products
# ---------------------------------------------------------------------------
class TestProducts:
    def test_list_products_has_seeded_eight(self, client):
        r = client.get(f"{API}/products")
        assert r.status_code == 200
        products = r.json()
        assert isinstance(products, list)
        # At least 8 seeded products (others may exist from prior test runs)
        assert len(products) >= 8
        # Verify expected seeded SKUs are present
        skus = {p["sku"] for p in products}
        expected_seed = {
            "COFF-001", "BOTL-220", "AUDIO-77", "BAG-101",
            "NOTE-A5", "CABL-USC", "CAND-SOY", "TOOT-BAM",
        }
        assert expected_seed.issubset(skus), f"Missing seeded SKUs: {expected_seed - skus}"

    def test_create_product_success(self, client, unique_sku):
        payload = {
            "name": "TEST_Gizmo",
            "sku": unique_sku,
            "category": "Gadgets",
            "stock_qty": 25,
            "reorder_threshold": 5,
        }
        r = client.post(f"{API}/products", json=payload)
        assert r.status_code == 201, r.text
        data = r.json()
        assert data["sku"] == unique_sku
        assert data["name"] == "TEST_Gizmo"
        assert data["stock_qty"] == 25
        assert "id" in data and isinstance(data["id"], int)
        assert "created_at" in data
        # Verify persistence
        g = client.get(f"{API}/products/{data['id']}")
        assert g.status_code == 200
        assert g.json()["sku"] == unique_sku
        # cleanup
        client.delete(f"{API}/products/{data['id']}")

    def test_create_product_duplicate_sku_returns_409(self, client, created_product):
        dup = {
            "name": "Duplicate",
            "sku": created_product["sku"],
            "category": "Testing",
            "stock_qty": 1,
            "reorder_threshold": 1,
        }
        r = client.post(f"{API}/products", json=dup)
        assert r.status_code == 409, r.text
        assert "already exists" in r.json().get("detail", "").lower()

    def test_get_product_not_found(self, client):
        r = client.get(f"{API}/products/99999999")
        assert r.status_code == 404

    def test_update_product(self, client, created_product):
        pid = created_product["id"]
        r = client.put(
            f"{API}/products/{pid}",
            json={"name": "TEST_Widget_Updated", "stock_qty": 77},
        )
        assert r.status_code == 200, r.text
        updated = r.json()
        assert updated["name"] == "TEST_Widget_Updated"
        assert updated["stock_qty"] == 77
        # Verify persistence
        g = client.get(f"{API}/products/{pid}").json()
        assert g["name"] == "TEST_Widget_Updated"
        assert g["stock_qty"] == 77

    def test_update_product_not_found(self, client):
        r = client.put(f"{API}/products/99999999", json={"name": "x"})
        assert r.status_code == 404

    def test_delete_product_cascades_sales(self, client, unique_sku):
        # Create product + a sale, then delete and verify both are gone
        create = client.post(f"{API}/products", json={
            "name": "TEST_ToDelete", "sku": unique_sku, "category": "Testing",
            "stock_qty": 10, "reorder_threshold": 2,
        })
        pid = create.json()["id"]
        s = client.post(f"{API}/sales", json={"product_id": pid, "quantity": 2})
        assert s.status_code == 201
        # Delete
        d = client.delete(f"{API}/products/{pid}")
        assert d.status_code == 204
        # Product should 404
        assert client.get(f"{API}/products/{pid}").status_code == 404
        # Sales for product should 404 (product missing)
        assert client.get(f"{API}/sales/product/{pid}").status_code == 404

    def test_create_product_validation_rejects_negative_stock(self, client, unique_sku):
        r = client.post(f"{API}/products", json={
            "name": "Bad", "sku": unique_sku, "category": "x",
            "stock_qty": -1, "reorder_threshold": 0,
        })
        assert r.status_code == 422


# ---------------------------------------------------------------------------
# Sales
# ---------------------------------------------------------------------------
class TestSales:
    def test_sale_decrements_stock(self, client, created_product):
        pid = created_product["id"]
        start_stock = created_product["stock_qty"]
        r = client.post(f"{API}/sales", json={"product_id": pid, "quantity": 3})
        assert r.status_code == 201, r.text
        sale = r.json()
        assert sale["product_id"] == pid
        assert sale["quantity"] == 3
        assert "id" in sale and "sold_at" in sale
        # Verify stock decremented
        p = client.get(f"{API}/products/{pid}").json()
        assert p["stock_qty"] == start_stock - 3

    def test_sale_insufficient_stock_returns_400(self, client, created_product):
        pid = created_product["id"]
        r = client.post(f"{API}/sales", json={
            "product_id": pid, "quantity": created_product["stock_qty"] + 5,
        })
        assert r.status_code == 400
        assert "insufficient" in r.json()["detail"].lower()

    def test_sale_missing_product_returns_404(self, client):
        r = client.post(f"{API}/sales", json={"product_id": 99999999, "quantity": 1})
        assert r.status_code == 404

    def test_sale_quantity_must_be_positive(self, client, created_product):
        r = client.post(f"{API}/sales", json={
            "product_id": created_product["id"], "quantity": 0,
        })
        assert r.status_code == 422
        r2 = client.post(f"{API}/sales", json={
            "product_id": created_product["id"], "quantity": -1,
        })
        assert r2.status_code == 422

    def test_list_sales(self, client):
        r = client.get(f"{API}/sales")
        assert r.status_code == 200
        sales = r.json()
        assert isinstance(sales, list)
        if sales:
            s0 = sales[0]
            assert {"id", "product_id", "quantity", "sold_at"}.issubset(s0.keys())

    def test_sales_for_product(self, client, created_product):
        pid = created_product["id"]
        client.post(f"{API}/sales", json={"product_id": pid, "quantity": 1})
        client.post(f"{API}/sales", json={"product_id": pid, "quantity": 2})
        r = client.get(f"{API}/sales/product/{pid}")
        assert r.status_code == 200
        sales = r.json()
        assert len(sales) >= 2
        assert all(s["product_id"] == pid for s in sales)

    def test_sales_for_missing_product_404(self, client):
        r = client.get(f"{API}/sales/product/99999999")
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# Insights
# ---------------------------------------------------------------------------
class TestInsights:
    REQUIRED_FIELDS = {
        "product_id", "name", "sku", "category", "stock_qty", "reorder_threshold",
        "recent_7_day_sales", "avg_daily_sales", "estimated_days_left",
        "reorder_flag", "suggested_reorder_qty",
    }

    def test_low_stock(self, client):
        r = client.get(f"{API}/insights/low-stock")
        assert r.status_code == 200
        data = r.json()
        assert "count" in data and "items" in data
        assert data["count"] == len(data["items"])
        # Each item must have all required fields and reorder_flag must be True
        for item in data["items"]:
            assert self.REQUIRED_FIELDS.issubset(item.keys()), item.keys()
            assert item["reorder_flag"] is True
            assert isinstance(item["avg_daily_sales"], (int, float))
            assert isinstance(item["recent_7_day_sales"], int)
            assert isinstance(item["suggested_reorder_qty"], int)

    def test_product_insight(self, client):
        # Pick any seeded product
        products = client.get(f"{API}/products").json()
        pid = products[0]["id"]
        r = client.get(f"{API}/insights/product/{pid}")
        assert r.status_code == 200
        data = r.json()
        assert self.REQUIRED_FIELDS.issubset(data.keys())
        assert data["product_id"] == pid

    def test_product_insight_handles_zero_sales(self, client, created_product):
        # Freshly-created product has no sales => avg_daily_sales 0 => days_left None
        r = client.get(f"{API}/insights/product/{created_product['id']}")
        assert r.status_code == 200
        data = r.json()
        assert data["recent_7_day_sales"] == 0
        assert data["avg_daily_sales"] == 0
        assert data["estimated_days_left"] is None

    def test_product_insight_not_found(self, client):
        r = client.get(f"{API}/insights/product/99999999")
        assert r.status_code == 404

    def test_product_ai_summary(self, client):
        products = client.get(f"{API}/products").json()
        pid = products[0]["id"]
        r = client.post(f"{API}/insights/product/{pid}/ai-summary")
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data.get("summary"), str) and len(data["summary"]) > 10
        assert data.get("provider") == "mock"
        assert data.get("insight", {}).get("product_id") == pid

    def test_product_ai_summary_404(self, client):
        r = client.post(f"{API}/insights/product/99999999/ai-summary")
        assert r.status_code == 404

    def test_daily_ai_summary(self, client):
        r = client.post(f"{API}/insights/daily-ai-summary")
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data["summary"], str) and len(data["summary"]) > 0
        assert data["provider"] == "mock"
        assert "low_stock_count" in data
        assert data["low_stock_count"] == len(data["items"])


# ---------------------------------------------------------------------------
# /api prefix enforcement
# ---------------------------------------------------------------------------
class TestApiPrefix:
    def test_root_api_reachable(self, client):
        r = client.get(f"{API}/")
        assert r.status_code == 200
        assert r.json().get("status") == "ready"

    def test_non_prefixed_routes_are_not_backend(self, client):
        # Without /api, the route should NOT be served by the backend.
        # (Ingress routes non-/api to the frontend, which returns HTML not JSON).
        r = client.get(f"{BASE_URL}/products")
        # Accept anything that ISN'T a valid backend product-list JSON array.
        if r.status_code == 200:
            ct = r.headers.get("content-type", "")
            assert "application/json" not in ct, "Products endpoint accessible without /api prefix"
