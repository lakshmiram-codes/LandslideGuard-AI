import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List

CAP_XMLNS = "urn:oasis:names:tc:emergency:cap:1.2"

CAP_VALID_STATUSES = {"Draft", "Test", "Actual", "Exercise"}
CAP_VALID_MSG_TYPES = {"Alert", "Update", "Cancel", "Ack", "Error"}
CAP_VALID_SCOPES = {"Public", "Restricted", "Private"}
CAP_VALID_URGENCIES = {"Immediate", "Expected", "Future", "Past", "Unknown"}
CAP_VALID_SEVERITIES = {"Extreme", "Severe", "Moderate", "Minor", "Unknown"}
CAP_VALID_CERTAINTIES = {"Observed", "Likely", "Possible", "Unlikely", "Unknown"}


class CapMessageBuilder:
    """Builds ITU-T X.1303 / OASIS CAP v1.2 compliant XML documents."""

    @staticmethod
    def generate_identifier(prefix: str = "IN-LG", suffix: Optional[str] = None) -> str:
        now = datetime.now(timezone.utc)
        date_str = now.strftime("%Y%m%d%H%M%S")
        sub = suffix or hex(int(now.microsecond))[2:].upper()
        return f"{prefix}-{date_str}-{sub}"

    @staticmethod
    def format_cap_timestamp(dt: Optional[datetime]) -> str:
        if not dt:
            dt = datetime.now(timezone.utc)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat(timespec="seconds")

    @classmethod
    def build_cap_xml(
        cls,
        identifier: str,
        sender: str,
        sent_at: Optional[datetime],
        status: str,
        msg_type: str,
        scope: str,
        headline: str,
        description: str,
        area_description: str,
        urgency: str = "Expected",
        severity: str = "Moderate",
        certainty: str = "Likely",
        category: str = "Geo",
        event: str = "Landslide Susceptibility Warning",
        instruction: Optional[str] = None,
        contact: Optional[str] = None,
        sender_name: Optional[str] = None,
        circle_lat: Optional[float] = None,
        circle_lon: Optional[float] = None,
        circle_radius_km: Optional[float] = None,
        effective_at: Optional[datetime] = None,
        expires_at: Optional[datetime] = None,
        parameters: Optional[Dict[str, Any]] = None,
        note: Optional[str] = None,
        references: Optional[str] = None,
    ) -> str:
        """Constructs an OASIS CAP v1.2 XML string."""
        # Root <alert> element
        root = ET.Element("alert", attrib={"xmlns": CAP_XMLNS})

        # Mandatory Alert header elements (order enforced per schema)
        ET.SubElement(root, "identifier").text = identifier.strip()
        ET.SubElement(root, "sender").text = sender.strip()
        ET.SubElement(root, "sent").text = cls.format_cap_timestamp(sent_at)
        ET.SubElement(root, "status").text = status
        ET.SubElement(root, "msgType").text = msg_type
        ET.SubElement(root, "scope").text = scope

        default_note = (
            note
            or "LandslideGuard AI Prototype Simulation Alert - Not for public broadcast or statutory action."
        )
        ET.SubElement(root, "note").text = default_note

        if references:
            ET.SubElement(root, "references").text = references

        # Mandatory <info> block
        info = ET.SubElement(root, "info")
        ET.SubElement(info, "language").text = "en-IN"
        ET.SubElement(info, "category").text = category
        ET.SubElement(info, "event").text = event
        ET.SubElement(info, "urgency").text = urgency
        ET.SubElement(info, "severity").text = severity
        ET.SubElement(info, "certainty").text = certainty

        event_code = ET.SubElement(info, "eventCode")
        ET.SubElement(event_code, "valueName").text = "SAME"
        ET.SubElement(event_code, "value").text = "LSW"  # Landslide Warning code

        if effective_at:
            ET.SubElement(info, "effective").text = cls.format_cap_timestamp(effective_at)

        if not expires_at:
            # Default expiry 12 hours from send
            expires_at = (sent_at or datetime.now(timezone.utc)) + timedelta(hours=12)
        ET.SubElement(info, "expires").text = cls.format_cap_timestamp(expires_at)

        if sender_name:
            ET.SubElement(info, "senderName").text = sender_name

        ET.SubElement(info, "headline").text = headline.strip()
        ET.SubElement(info, "description").text = description.strip()

        if instruction:
            ET.SubElement(info, "instruction").text = instruction.strip()

        if contact:
            ET.SubElement(info, "contact").text = contact.strip()

        # Add parameters
        if parameters:
            for k, v in parameters.items():
                param_elem = ET.SubElement(info, "parameter")
                ET.SubElement(param_elem, "valueName").text = str(k)
                ET.SubElement(param_elem, "value").text = str(v)

        # <area> block
        area = ET.SubElement(info, "area")
        ET.SubElement(area, "areaDesc").text = area_description.strip()

        if circle_lat is not None and circle_lon is not None and circle_radius_km is not None:
            # Format: "latitude,longitude radius"
            ET.SubElement(area, "circle").text = f"{circle_lat:.4f},{circle_lon:.4f} {circle_radius_km:.1f}"

        # Serialize XML with declaration
        return ET.tostring(root, encoding="utf-8", xml_declaration=True).decode("utf-8")
