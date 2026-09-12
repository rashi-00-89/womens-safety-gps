from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import psycopg2
from psycopg2.extras import RealDictCursor

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_connection():
    return psycopg2.connect(
        host="localhost",
        dbname="sentinel_db",
        user="rashisingh"
    )

@app.get("/")
def home():
    return {"message": "Sentinel API is running!"}

@app.get("/hexagons")
def get_hexagons():
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT hex_id, final_sri FROM hexagons LIMIT 10;")
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows

@app.get("/safety-at")
def safety_at(lat: float, lon: float):
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT hex_id, final_sri, crime_sri, access_sri,
               ST_Distance(
                   geom::geography, 
                   ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography
               ) as distance_meters
        FROM hexagons
        ORDER BY geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
        LIMIT 1;
    """, (lon, lat, lon, lat))
    result = cur.fetchone()
    cur.close()
    conn.close()
    return result

@app.get("/all-hexagons")
def get_all_hexagons():
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT hex_id, final_sri, crime_sri, access_sri,
               ST_AsGeoJSON(geom) as geometry
        FROM hexagons;
    """)
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows

@app.get("/facilities")
def get_facilities():
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT name, type, lat, lon FROM facilities;")
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows
