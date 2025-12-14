from fastapi import APIRouter, Depends, HTTPException, Response, Request
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User
from app.schemas import AuthLoginPayload, AuthRegisterPayload, UserOut
from app.auth import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return UserOut(id=user.id, email=user.email, full_name=user.full_name)


@router.post("/register", response_model=UserOut)
def register(payload: AuthRegisterPayload, request: Request, response: Response, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    if not email or not payload.password:
        raise HTTPException(status_code=400, detail="Invalid payload")

    exists = db.query(User).filter(User.email == email).first()
    if exists:
        raise HTTPException(status_code=409, detail="Email already exists")

    user = User(
        email=email,
        full_name=(payload.full_name or "").strip() or None,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(
        subject=str(user.id),
        secret_key=request.app.state.SECRET_KEY,
        expires_minutes=request.app.state.ACCESS_TOKEN_EXPIRE_MINUTES,
    )

    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,  # w prod: True (https)
        path="/",
        max_age=60 * request.app.state.ACCESS_TOKEN_EXPIRE_MINUTES,
    )

    return UserOut(id=user.id, email=user.email, full_name=user.full_name)


@router.post("/login", response_model=UserOut)
def login(payload: AuthLoginPayload, request: Request, response: Response, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(
        subject=str(user.id),
        secret_key=request.app.state.SECRET_KEY,
        expires_minutes=request.app.state.ACCESS_TOKEN_EXPIRE_MINUTES,
    )

    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,
        path="/",
        max_age=60 * request.app.state.ACCESS_TOKEN_EXPIRE_MINUTES,
    )

    return UserOut(id=user.id, email=user.email, full_name=user.full_name)


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}
