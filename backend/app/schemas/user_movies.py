from typing import Optional
from pydantic import BaseModel, ConfigDict


class MovieStateUpdate(BaseModel):
    favorite: Optional[bool] = None
    watched: Optional[bool] = None


class MovieStateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    tmdb_id: str
    favorite: bool
    watched: bool