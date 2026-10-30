from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user_optional, ensure_default_users
from app.models.user import User
from app.schemas.user import UserResponse

router = APIRouter()


@router.get(
    "/users",
    response_model=List[UserResponse],
    summary="List available demo user roles for testing and identity selection",
)
def list_demo_users(
    db: Session = Depends(get_db),
) -> List[UserResponse]:
    """Returns available users/roles, auto-seeding defaults if empty."""
    ensure_default_users(db)
    users = db.query(User).filter(User.is_active == True).order_by(User.id.asc()).all()
    return [UserResponse.model_validate(u) for u in users]


@router.get(
    "/me",
    response_model=Optional[UserResponse],
    summary="Get current user identity resolved from request headers",
)
def get_current_user_profile(
    current_user: Optional[User] = Depends(get_current_user_optional),
) -> Optional[UserResponse]:
    if not current_user:
        return None
    return UserResponse.model_validate(current_user)
