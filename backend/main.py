from fastapi import FastAPI

# Create a FastAPI instance
app = FastAPI()

# Define an endpoint
@app.get("/api/hello")
def hello():
    return {"message": "Hello from FastAPI backend!"}