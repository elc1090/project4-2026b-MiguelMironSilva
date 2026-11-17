from pydantic import BaseModel, ConfigDict, Field, field_validator


class UserCreate(BaseModel):
    # Public registration deliberately ignores privilege/identity extras.
    model_config = ConfigDict(extra="ignore")

    username: str = Field(min_length=3, max_length=30)
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("username", "email", mode="before")
    @classmethod
    def strip_identity(cls, value):
        return value.strip() if isinstance(value, str) else value

class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    is_superuser: bool

class LoginRequest(BaseModel):
    identifier: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str