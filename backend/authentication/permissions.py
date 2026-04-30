from rest_framework.permissions import BasePermission
from .models import Role


class IsOwner(BasePermission):
    """Allows access only to users with role OWNER."""

    message = "Only gym owners can perform this action."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == Role.OWNER
        )


class IsTrainer(BasePermission):
    """Allows access only to users with role TRAINER."""

    message = "Only trainers can perform this action."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == Role.TRAINER
        )


class IsMember(BasePermission):
    """Allows access only to users with role MEMBER."""

    message = "Only members can perform this action."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == Role.MEMBER
        )


class IsOwnerOrTrainer(BasePermission):
    """Allows access to OWNER or TRAINER roles."""

    message = "Only owners or trainers can perform this action."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in [Role.OWNER, Role.TRAINER]
        )


class IsOwnerOrReadOnly(BasePermission):
    """
    Object-level permission: only the resource owner (the user who created it)
    can write; everyone else gets read-only.
    Expects the model instance to have an `owner` or `user` field.
    """

    def has_object_permission(self, request, view, obj):
        from rest_framework.permissions import SAFE_METHODS

        if request.method in SAFE_METHODS:
            return True
        owner = getattr(obj, "owner", None) or getattr(obj, "user", None)
        return owner == request.user
