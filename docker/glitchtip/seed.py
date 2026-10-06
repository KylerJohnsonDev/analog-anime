# Seeds a fresh local GlitchTip with a shared dev login, the analog-anime organization and project,
# a fixed DSN key and a fixed auth token for source map uploads. Run by the `glitchtip-seed` service
# in compose.yaml through `./manage.py shell`, so it uses GlitchTip's own models.
#
# Everything is created only if it's missing, so this is safe to run on every `docker compose up`.
# These credentials are for local development only: GlitchTip is bound to 127.0.0.1 and holds only
# local test data.

import os

from django.contrib.auth import get_user_model

from apps.api_tokens.models import APIToken
from apps.organizations_ext.models import Organization, OrganizationUser, OrganizationUserRole
from apps.projects.models import Project, ProjectKey

EMAIL = "dev@analog-anime.com"
PASSWORD = "Pa$$word123"
ORG_SLUG = "analog-anime"
PROJECT_SLUG = "analog-anime"
# The DSN's project ID. A fresh GlitchTip gives its first project ID 1.
EXPECTED_PROJECT_ID = 1
TOKEN_SCOPES = ["project:read", "project:write", "project:releases", "org:read"]

public_key = os.environ["SEED_DSN_PUBLIC_KEY"]
with open("/run/secrets/sentry_auth_token") as f:
    auth_token = f.read().strip()

User = get_user_model()
user = User.objects.filter(email=EMAIL).first()
if user is None:
    user = User.objects.create_user(email=EMAIL, password=PASSWORD)
    print(f"Created user {EMAIL}")

org = Organization.objects.filter(slug=ORG_SLUG).first()
if org is None:
    org = Organization.objects.create(name="Analog Anime", slug=ORG_SLUG)
    print(f"Created organization {ORG_SLUG}")

if not OrganizationUser.objects.filter(organization=org, user=user).exists():
    org.add_user(user, role=OrganizationUserRole.OWNER)
    print(f"Added {EMAIL} to {ORG_SLUG} as an owner")

project = Project.objects.filter(organization=org, slug=PROJECT_SLUG).first()
if project is None:
    project = Project.objects.create(
        name="analog-anime", slug=PROJECT_SLUG, organization=org, platform="javascript-angular"
    )
    # GlitchTip adds a random key to every new project. Only the fixed key below should exist,
    # so the DSN shown in GlitchTip matches the one in compose.yaml.
    ProjectKey.objects.filter(project=project).delete()
    print(f"Created project {PROJECT_SLUG}")

if project.id != EXPECTED_PROJECT_ID:
    print(
        f"WARNING: project {PROJECT_SLUG} has ID {project.id}, but the DSN in compose.yaml expects "
        f"{EXPECTED_PROJECT_ID}. Events won't arrive. Reset GlitchTip's volumes to fix this."
    )

if not ProjectKey.objects.filter(public_key=public_key).exists():
    ProjectKey.objects.create(project=project, public_key=public_key, name="Shared local dev key")
    print("Created the shared DSN key")

if not APIToken.objects.filter(token=auth_token).exists():
    flags = list(APIToken._meta.get_field("scopes").flags)
    APIToken.objects.create(
        user=user,
        token=auth_token,
        label="Source map uploads (local dev)",
        scopes=sum(1 << flags.index(scope) for scope in TOKEN_SCOPES),
    )
    print("Created the source map upload token")

print("GlitchTip seed complete")
