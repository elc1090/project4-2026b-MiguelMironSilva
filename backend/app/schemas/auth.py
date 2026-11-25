from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator, model_validator


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


class CurrentUserResponse(UserResponse):
    has_password: bool = True


class GoogleExchangeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str = Field(pattern=r"^[A-Za-z0-9_-]{43}$")
    verifier: str = Field(pattern=r"^[A-Za-z0-9_-]{43}$")


class GooglePasswordStartRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    challenge: str = Field(pattern=r"^[A-Za-z0-9_-]{43}$")


class PasswordUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    new_password: SecretStr = Field(min_length=8, max_length=128)
    current_password: SecretStr | None = Field(default=None, min_length=1, max_length=128)
    code: str | None = Field(default=None, pattern=r"^[A-Za-z0-9_-]{43}$")
    verifier: str | None = Field(default=None, pattern=r"^[A-Za-z0-9_-]{43}$")

    @model_validator(mode="after")
    def require_exactly_one_proof(self):
        if self.current_password is not None:
            if self.code is None and self.verifier is None:
                return self
        elif self.code is not None and self.verifier is not None:
            return self
        raise ValueError("Informe apenas um método de confirmação")


class DeleteAccountRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    password: SecretStr


class LoginRequest(BaseModel):
    identifier: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str