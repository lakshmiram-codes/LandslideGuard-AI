from typing import Optional, List
from fastapi import Header, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.models.incident import IncidentReport

# Standard System Roles
ROLE_CITIZEN = "citizen"
ROLE_FIELD_OBSERVER = "field_observer"
ROLE_OFFICIAL_DDMA = "official_ddma"
ROLE_ADMIN = "admin"
ROLE_OPERATOR = "operator"

REVIEWER_ROLES = [ROLE_OFFICIAL_DDMA, ROLE_FIELD_OBSERVER, ROLE_ADMIN]
CAP_APPROVER_ROLES = [ROLE_OFFICIAL_DDMA, ROLE_ADMIN]

DEMO_USERS_SEEDS = [
    {
        "email": "citizen@landslideguard.local",
        "display_name": "Citizen Observer Aarav",
        "role": ROLE_CITIZEN,
    },
    {
        "email": "observer@landslideguard.local",
        "display_name": "Field Patrol Officer Raman",
        "role": ROLE_FIELD_OBSERVER,
    },
    {
        "email": "ddma.officer@landslideguard.local",
        "display_name": "DDMA District Officer Sharma",
        "role": ROLE_OFFICIAL_DDMA,
    },
    {
        "email": "admin@landslideguard.local",
        "display_name": "State Disaster Control Admin",
        "role": ROLE_ADMIN,
    },
]


def ensure_default_users(db: Session) -> None:
    """Idempotently seeds standard identity roles if users table is empty."""
    for u_data in DEMO_USERS_SEEDS:
        existing = db.query(User).filter(User.email == u_data["email"]).first()
        if not existing:
            u = User(
                email=u_data["email"],
                display_name=u_data["display_name"],
                role=u_data["role"],
                is_active=True,
            )
            db.add(u)
    db.commit()


def get_current_user_optional(
    x_user_email: Optional[str] = Header(None, alias="X-User-Email"),
    x_user_id: Optional[int] = Header(None, alias="X-User-Id"),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Resolves active user identity from HTTP headers or Bearer email token."""
    # 1. By explicit ID header
    if x_user_id is not None:
        user = db.query(User).filter(User.id == x_user_id, User.is_active == True).first()
        if user:
            return user

    # 2. By explicit Email header
    if x_user_email:
        clean_email = x_user_email.strip().lower()
        user = db.query(User).filter(User.email == clean_email, User.is_active == True).first()
        if user:
            return user

    # 3. By Authorization: Bearer <email_or_role>
    if authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "").strip().lower()
        if "@" in token:
            user = db.query(User).filter(User.email == token, User.is_active == True).first()
            if user:
                return user
        # Allow Bearer <role> shortcut in test environments
        user = db.query(User).filter(User.role == token, User.is_active == True).first()
        if user:
            return user

    return None


def get_current_user_required(
    current_user: Optional[User] = Depends(get_current_user_optional),
) -> User:
    """Requires an authenticated identity; raises HTTP 401 if missing."""
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=(
                "Authentication required. Provide 'X-User-Email', 'X-User-Id', "
                "or 'Authorization: Bearer <email>' header."
            ),
            headers={"WWW-Authenticate": "Bearer"},
        )
    return current_user


def require_roles(allowed_roles: List[str]):
    """Returns a dependency ensuring current user has one of the allowed roles."""
    def role_checker(current_user: User = Depends(get_current_user_required)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Access denied: User role '{current_user.role}' is not authorized. "
                    f"Required one of: {', '.join(allowed_roles)}."
                ),
            )
        return current_user
    return role_checker


# Role dependencies
require_reviewer = require_roles(REVIEWER_ROLES)
require_cap_approver = require_roles(CAP_APPROVER_ROLES)
require_admin = require_roles([ROLE_ADMIN])


def check_prevent_self_approval(incident: IncidentReport, current_user: User) -> None:
    """Enforces separation of duties: prevents users from approving/verifying their own reports."""
    if (
        incident.reporter_user_id is not None
        and incident.reporter_user_id == current_user.id
        and current_user.role != ROLE_ADMIN  # Admins retain systemic override
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Conflict of interest: You cannot verify or approve an incident report "
                "that you originally submitted. A different authorized reviewer must review this report."
            ),
        )
