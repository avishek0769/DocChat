from pageindex import PageIndexClient
from dotenv import load_dotenv
import os

load_dotenv(dotenv_path="../.env")
PAGEINDEX_API_KEY = os.getenv("PAGEINDEX_API_KEY")

pi_client = PageIndexClient(api_key=PAGEINDEX_API_KEY)

