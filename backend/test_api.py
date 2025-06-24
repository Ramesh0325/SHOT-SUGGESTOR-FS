#!/usr/bin/env python3

import requests
import json

def test_api():
    """Test the sessions API endpoint"""
    base_url = "http://localhost:8000"
    
    # Get a test token first (you'll need valid credentials)
    print("To test the API, you need to:")
    print("1. Make sure the backend server is running")
    print("2. Login to get a valid token")
    print("3. Test the sessions endpoint")
    print()
    print("Test URL: GET /projects/b157bc75-134d-4ff5-b4fe-8f9a8d8c30f6/sessions")
    print("Expected response: List of 4 sessions")

if __name__ == "__main__":
    test_api()
