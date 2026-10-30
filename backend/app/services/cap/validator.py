import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from typing import List, Optional
from datetime import datetime

from app.services.cap.builder import (
    CAP_XMLNS,
    CAP_VALID_STATUSES,
    CAP_VALID_MSG_TYPES,
    CAP_VALID_SCOPES,
    CAP_VALID_URGENCIES,
    CAP_VALID_SEVERITIES,
    CAP_VALID_CERTAINTIES,
)


@dataclass
class CapValidationResult:
    is_valid: bool
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    identifier: Optional[str] = None
    status: Optional[str] = None
    msg_type: Optional[str] = None
    scope: Optional[str] = None


class CapSchemaValidator:
    """Validates Common Alerting Protocol (CAP v1.2) XML payload structure and value enumerations."""

    @classmethod
    def validate_xml(cls, xml_content: str) -> CapValidationResult:
        errors: List[str] = []
        warnings: List[str] = []

        if not xml_content or not xml_content.strip():
            return CapValidationResult(is_valid=False, errors=["CAP XML document is empty."])

        try:
            root = ET.fromstring(xml_content.strip())
        except ET.ParseError as pe:
            return CapValidationResult(
                is_valid=False,
                errors=[f"XML Syntax Error: Malformed XML document ({str(pe)})."],
            )

        # Check root tag and namespace
        expected_tag = f"{{{CAP_XMLNS}}}alert"
        if root.tag != expected_tag and root.tag != "alert":
            errors.append(f"Root element must be <alert> with namespace '{CAP_XMLNS}', found: {root.tag}")

        ns = {"cap": CAP_XMLNS} if "}" in root.tag else {}
        prefix = "cap:" if ns else ""

        def find_text(elem: ET.Element, tag: str) -> Optional[str]:
            child = elem.find(f"{prefix}{tag}", ns)
            if child is not None and child.text:
                return child.text.strip()
            return None

        # Mandatory Alert Fields
        identifier = find_text(root, "identifier")
        if not identifier:
            errors.append("Mandatory element <identifier> is missing or empty.")

        sender = find_text(root, "sender")
        if not sender:
            errors.append("Mandatory element <sender> is missing or empty.")

        sent = find_text(root, "sent")
        if not sent:
            errors.append("Mandatory element <sent> is missing or empty.")
        else:
            try:
                datetime.fromisoformat(sent.replace("Z", "+00:00"))
            except ValueError:
                errors.append(f"Element <sent> has invalid ISO 8601 timestamp: '{sent}'.")

        status_val = find_text(root, "status")
        if not status_val:
            errors.append("Mandatory element <status> is missing or empty.")
        elif status_val not in CAP_VALID_STATUSES:
            errors.append(f"Invalid <status> '{status_val}'. Permitted: {sorted(CAP_VALID_STATUSES)}.")

        msg_type_val = find_text(root, "msgType")
        if not msg_type_val:
            errors.append("Mandatory element <msgType> is missing or empty.")
        elif msg_type_val not in CAP_VALID_MSG_TYPES:
            errors.append(f"Invalid <msgType> '{msg_type_val}'. Permitted: {sorted(CAP_VALID_MSG_TYPES)}.")

        scope_val = find_text(root, "scope")
        if not scope_val:
            errors.append("Mandatory element <scope> is missing or empty.")
        elif scope_val not in CAP_VALID_SCOPES:
            errors.append(f"Invalid <scope> '{scope_val}'. Permitted: {sorted(CAP_VALID_SCOPES)}.")

        # Safety Check: Warn or reject 'Actual' status in dev prototype
        if status_val == "Actual":
            warnings.append(
                "SAFETY WARNING: CAP message status is 'Actual'. Official statutory authorization required for dispatch."
            )

        # Mandatory <info> block
        info = root.find(f"{prefix}info", ns)
        if info is None:
            errors.append("Mandatory element <info> block is missing.")
        else:
            category = find_text(info, "category")
            if not category:
                errors.append("Mandatory element <category> inside <info> is missing.")

            event = find_text(info, "event")
            if not event:
                errors.append("Mandatory element <event> inside <info> is missing.")

            urgency = find_text(info, "urgency")
            if not urgency or urgency not in CAP_VALID_URGENCIES:
                errors.append(f"Invalid or missing <urgency> inside <info>. Permitted: {sorted(CAP_VALID_URGENCIES)}.")

            severity = find_text(info, "severity")
            if not severity or severity not in CAP_VALID_SEVERITIES:
                errors.append(f"Invalid or missing <severity> inside <info>. Permitted: {sorted(CAP_VALID_SEVERITIES)}.")

            certainty = find_text(info, "certainty")
            if not certainty or certainty not in CAP_VALID_CERTAINTIES:
                errors.append(f"Invalid or missing <certainty> inside <info>. Permitted: {sorted(CAP_VALID_CERTAINTIES)}.")

            headline = find_text(info, "headline")
            if not headline:
                errors.append("Mandatory element <headline> inside <info> is missing.")

            description = find_text(info, "description")
            if not description:
                errors.append("Mandatory element <description> inside <info> is missing.")

            # <area> block
            area = info.find(f"{prefix}area", ns)
            if area is None:
                errors.append("Mandatory element <area> inside <info> is missing.")
            else:
                area_desc = find_text(area, "areaDesc")
                if not area_desc:
                    errors.append("Mandatory element <areaDesc> inside <area> is missing or empty.")

        is_valid = len(errors) == 0
        return CapValidationResult(
            is_valid=is_valid,
            errors=errors,
            warnings=warnings,
            identifier=identifier,
            status=status_val,
            msg_type=msg_type_val,
            scope=scope_val,
        )


cap_validator = CapSchemaValidator()
