from pydantic import BaseModel, ConfigDict


class MovieStateUpdate(BaseModel):
    favorite: bool = False
    watched: bool = False
    watchlist: bool = False


class MovieStateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    tmdb_id: str
    favorite: bool
    watched: bool
    watchlist: bool
