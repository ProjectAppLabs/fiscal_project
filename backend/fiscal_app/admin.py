
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from .forms.user import UserChangeForm, UserCreationForm
from .models import (
    Artifact,
    Certificate,
    ClientSystem,
    Document,
    DocumentEvent,
    Issuer,
    NumberingRange,
    PasswordCode,
    SoftwareRegistration,
    StagingPhaseBanner,
    User,
    WebhookDelivery,
)

# ============================================================================
# USER MANAGEMENT
# ============================================================================

class FiscalUserAdmin(UserAdmin):
    add_form = UserCreationForm
    form = UserChangeForm
    ordering = ('email',)
    list_display = ('email', 'first_name', 'last_name', 'role', 'is_staff', 'is_active')
    list_filter = ('role', 'is_staff', 'is_active')
    search_fields = ('email', 'first_name', 'last_name')
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        (_('Personal info'), {'fields': ('first_name', 'last_name', 'phone')}),
        (_('Role'), {'fields': ('role',)}),
        (
            _('Permissions'),
            {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')},
        ),
        (_('Important dates'), {'fields': ('last_login', 'date_joined')}),
    )
    add_fieldsets = (
        (
            None,
            {
                'classes': ('wide',),
                'fields': ('email', 'password1', 'password2', 'role'),
            },
        ),
    )

    readonly_fields = ('date_joined',)
    filter_horizontal = ('groups', 'user_permissions')


class PasswordCodeAdmin(admin.ModelAdmin):
    list_display = ('user', 'code', 'created_at', 'used')
    search_fields = ('user__email', 'code')
    list_filter = ('used', 'created_at')
    readonly_fields = ('created_at',)

    def has_add_permission(self, request):
        # Don't allow manual creation from admin
        return False


# ============================================================================
# STAGING PHASE BANNER
# ============================================================================
# DO NOT DELETE this admin: it controls the staging review banner shown to
# clients. Hide via the `is_visible` toggle / "Hide banner" action — never
# unregister or remove the model. See `pre-staging-cleanup` skill for details.

class StagingPhaseBannerAdmin(admin.ModelAdmin):
    list_display = ('current_phase', 'is_visible', 'started_at', 'expires_at', 'days_remaining')
    readonly_fields = ('expires_at', 'days_remaining', 'is_expired', 'updated_at')
    fieldsets = (
        (_('Visibility'), {'fields': ('is_visible',)}),
        (_('Phase'), {'fields': ('current_phase', 'started_at', 'expires_at', 'days_remaining', 'is_expired')}),
        (_('Durations (calendar days)'), {'fields': ('design_duration_days', 'development_duration_days')}),
        (_('Contact'), {'fields': ('contact_whatsapp', 'contact_email')}),
        (_('Audit'), {'fields': ('updated_at',)}),
    )
    actions = ['start_design_phase', 'start_development_phase', 'show_banner', 'hide_banner']

    def has_add_permission(self, request):
        return not StagingPhaseBanner.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False

    def start_design_phase(self, request, queryset):
        for obj in queryset:
            obj.current_phase = StagingPhaseBanner.PHASE_DESIGN
            obj.started_at = timezone.now()
            obj.save()
        self.message_user(request, _('Design phase started. Countdown reset.'))
    start_design_phase.short_description = _('▶ Start design phase (resets countdown)')

    def start_development_phase(self, request, queryset):
        for obj in queryset:
            obj.current_phase = StagingPhaseBanner.PHASE_DEVELOPMENT
            obj.started_at = timezone.now()
            obj.save()
        self.message_user(request, _('Development phase started. Countdown reset.'))
    start_development_phase.short_description = _('▶ Start development phase (resets countdown)')

    def show_banner(self, request, queryset):
        queryset.update(is_visible=True)
        self.message_user(request, _('Banner shown.'))
    show_banner.short_description = _('👁 Show banner')

    def hide_banner(self, request, queryset):
        queryset.update(is_visible=False)
        self.message_user(request, _('Banner hidden.'))
    hide_banner.short_description = _('🙈 Hide banner')



# ============================================================================
# FISCAL. — secrets never appear in admin forms or lists
# ============================================================================

class ReadOnlyAdmin(admin.ModelAdmin):
    """Records written only by the service (documents and their trail): visible, never edited by hand."""

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class ClientSystemAdmin(admin.ModelAdmin):
    list_display = ('name', 'key_id', 'active', 'webhook_url', 'created_at')
    list_filter = ('active',)
    search_fields = ('name', 'key_id')
    readonly_fields = ('key_id', 'created_at')
    fields = ('name', 'key_id', 'webhook_url', 'active', 'created_at')

    def has_add_permission(self, request):
        # Created with `manage.py create_client_system`, which shows the secret once.
        return False


class IssuerAdmin(admin.ModelAdmin):
    list_display = ('legal_name', 'nit', 'dv', 'client', 'environment', 'active')
    list_filter = ('environment', 'active', 'client')
    search_fields = ('legal_name', 'trade_name', 'nit')


class SoftwareRegistrationAdmin(admin.ModelAdmin):
    list_display = ('issuer', 'environment', 'software_id', 'software_name', 'active')
    list_filter = ('environment', 'active')
    search_fields = ('issuer__nit', 'issuer__legal_name', 'software_id')
    exclude = ('software_pin',)

    def has_add_permission(self, request):
        # The PIN is a secret: it only enters through the API.
        return False


class CertificateAdmin(admin.ModelAdmin):
    list_display = ('issuer', 'subject', 'serial', 'not_after', 'active')
    list_filter = ('active',)
    search_fields = ('issuer__nit', 'subject', 'serial')
    fields = ('issuer', 'subject', 'issued_by', 'serial', 'not_before', 'not_after', 'active', 'created_at')
    readonly_fields = fields

    def has_add_permission(self, request):
        # Certificates are validated and encrypted by the API; they are never typed in by hand.
        return False


class NumberingRangeAdmin(admin.ModelAdmin):
    list_display = ('issuer', 'kind', 'prefix', 'number_from', 'number_to', 'valid_to', 'active')
    list_filter = ('kind', 'active')
    search_fields = ('issuer__nit', 'resolution_number', 'prefix')
    exclude = ('technical_key',)

    def has_add_permission(self, request):
        # The technical key is a secret: ranges enter through the API.
        return False


class DocumentAdmin(ReadOnlyAdmin):
    list_display = ('full_number', 'kind', 'issuer', 'state', 'attempts', 'created_at')
    list_filter = ('state', 'kind')
    search_fields = ('issuer__nit', 'idempotency_key', 'cufe')


class DocumentEventAdmin(ReadOnlyAdmin):
    list_display = ('document', 'state', 'created_at')
    list_filter = ('state',)


class ArtifactAdmin(ReadOnlyAdmin):
    list_display = ('document', 'kind', 'size', 'sha256', 'retain_until')
    list_filter = ('kind',)


class WebhookDeliveryAdmin(ReadOnlyAdmin):
    list_display = ('client', 'document', 'attempts', 'last_status', 'delivered_at')
    list_filter = ('client',)


# ============================================================================
# CUSTOM ADMIN SITE - ORGANIZED BY SECTIONS
# ============================================================================

class FiscalAdminSite(admin.AdminSite):
    site_header = 'Fiscal. · Administración'
    site_title = 'Fiscal.'
    index_title = 'Panel de administración de Fiscal.'

    def get_app_list(self, request):
        app_dict = self._build_app_dict(request)
        base_app_models = app_dict.get('fiscal_app', {}).get('models', [])
        
        # Custom structure for the admin index organized by sections
        custom_app_list = [
            {
                'name': _('🧾 Fiscal. · Clientes y emisores'),
                'app_label': 'fiscal_parties',
                'models': [
                    model for model in base_app_models
                    if model['object_name'] in ['ClientSystem', 'Issuer', 'SoftwareRegistration', 'Certificate', 'NumberingRange']
                ]
            },
            {
                'name': _('📄 Fiscal. · Documentos'),
                'app_label': 'fiscal_documents',
                'models': [
                    model for model in base_app_models
                    if model['object_name'] in ['Document', 'DocumentEvent', 'Artifact', 'WebhookDelivery']
                ]
            },
            {
                'name': _('👥 User Management'),
                'app_label': 'user_management',
                'models': [
                    model for model in base_app_models
                    if model['object_name'] in ['User', 'PasswordCode']
                ]
            },
            {
                'name': _('🚧 Staging Phase Banner'),
                'app_label': 'staging_management',
                'models': [
                    model for model in base_app_models
                    if model['object_name'] in ['StagingPhaseBanner']
                ]
            },
        ]
        
        # Filter out empty sections
        custom_app_list = [section for section in custom_app_list if section['models']]
        
        return custom_app_list


# ============================================================================
# REGISTER MODELS
# ============================================================================

# Create an instance of the custom AdminSite
admin_site = FiscalAdminSite(name='myadmin')

# Register all models with the custom AdminSite
admin_site.register(User, FiscalUserAdmin)
admin_site.register(PasswordCode, PasswordCodeAdmin)
admin_site.register(StagingPhaseBanner, StagingPhaseBannerAdmin)
admin_site.register(ClientSystem, ClientSystemAdmin)
admin_site.register(Issuer, IssuerAdmin)
admin_site.register(SoftwareRegistration, SoftwareRegistrationAdmin)
admin_site.register(Certificate, CertificateAdmin)
admin_site.register(NumberingRange, NumberingRangeAdmin)
admin_site.register(Document, DocumentAdmin)
admin_site.register(DocumentEvent, DocumentEventAdmin)
admin_site.register(Artifact, ArtifactAdmin)
admin_site.register(WebhookDelivery, WebhookDeliveryAdmin)
