from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator


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

class AdminUserResponse(BaseModel):
    id: str
    username: str
    is_superuser: bool


class UserResponse(AdminUserResponse):
    email: str


class DeleteAccountRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    password: SecretStr


class LoginRequest(BaseModel):
    identifier: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str