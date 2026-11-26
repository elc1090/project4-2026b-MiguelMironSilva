from datetime import datetime, timezone
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator


class ReviewWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: Annotated[str | None, StringConstraints(strip_whitespace=True, max_length=2000)] = None
    rating: int | None = Field(default=None, ge=1, le=10)

    @field_validator("text", mode="before")
    @classmethod
    def blank_text_becomes_none(cls, value):
        if isinstance(value, str) and not value.strip():
            return None
        return value

class ReviewAuthor(BaseModel):
    model_config = ConfigDict(from_attributes=True, coerce_numbers_to_str=True)

    id: str
    username: str


class ReviewSummaryResponse(BaseModel):
    summary: str | None
    review_count: int = Field(ge=0)


class ReviewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tmdb_id: int
    author: ReviewAuthor
    text: str | None
    rating: int | None
    created_at: datetime
    updated_at: datetime | None

    @field_validator("created_at", "updated_at")
    @classmethod
    def normalize_utc(cls, value: datetime | None) -> datetime | None:
        # O SQLite descarta deslocamentos; estes horários são gravados em UTC.
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)
