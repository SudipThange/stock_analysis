from django.db import models
from django.core.validators import RegexValidator, EmailValidator
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.utils import timezone


# -------------------------------
# Custom User Manager
# -------------------------------
class UserManager(BaseUserManager):
    def create_user(self, email, name, password=None):
        if not email:
            raise ValueError("Email is required")

        email = self.normalize_email(email)
        user = self.model(email=email, name=name)
        user.set_password(password)  # hashes password
        user.save(using=self._db)
        return user

    def create_superuser(self, email, name, password):
        user = self.create_user(email, name, password)
        user.is_staff = True
        user.is_superuser = True
        user.save(using=self._db)
        return user


# -------------------------------
# Password Regex Validator
# -------------------------------
password_validator = RegexValidator(
    regex=r'^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@#$%^&+=]{8,}$',
    message="Password must be at least 8 characters long and contain letters and numbers."
)


# -------------------------------
# Custom User Model
# -------------------------------
class User(AbstractBaseUser, PermissionsMixin):

    id = models.BigAutoField(primary_key=True)

    name = models.CharField(max_length=150)

    email = models.EmailField(
        unique=True,
        validators=[EmailValidator()]
    )

    password = models.CharField(
        max_length=255,
        validators=[password_validator]
    )

    created_at = models.DateTimeField(default=timezone.now)

    modified_at = models.DateTimeField(auto_now=True)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['name']

    def __str__(self):
        return self.email