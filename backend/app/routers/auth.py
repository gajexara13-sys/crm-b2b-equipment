from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta
from app.database import get_db
from app.models.user import User
import os

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
SECRET_KEY = os.getenv("SECRET_KEY", "rutest-secret-key-2025")
ALGORITHM = "HS256"

def verify_password(plain, hashed): return pwd_context.verify(plain, hashed)
def hash_password(password): return pwd_context.hash(password)
def create_token(data: dict):
    d = data.copy()
    d.update({"exp": datetime.utcnow() + timedelta(hours=24)})
    return jwt.encode(d, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id: raise HTTPException(status_code=401, detail="Неверный токен")
    except JWTError:
        raise HTTPException(status_code=401, detail="Неверный токен")
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user: raise HTTPException(status_code=401, detail="Пользователь не найден")
    return user

@router.post("/login")
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form.username).first()
    if not user or not verify_password(form.password, user.hashed_pwd):
        raise HTTPException(status_code=401, detail="Неверный email или пароль")
    return {"access_token": create_token({"sub": str(user.id)}), "token_type": "bearer",
            "user": {"id": user.id, "name": user.name, "email": user.email, "role": user.role}}

@router.post("/register")
def register(name: str, email: str, password: str, role: str = "laborant", db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email уже зарегистрирован")
    user = User(name=name, email=email, hashed_pwd=hash_password(password), role=role)
    db.add(user); db.commit(); db.refresh(user)
    return {"id": user.id, "name": user.name, "email": user.email, "role": user.role}

@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    return {"id": current_user.id, "name": current_user.name,
            "email": current_user.email, "role": current_user.role}
