import xml.etree.ElementTree as ET
import sys

path = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\shiver\Desktop\cjj\now_dump.xml"
out = path + ".txt"
tree = ET.parse(path)
root = tree.getroot()
lines = []
lines.append("=== TEXTS ===")
for n in root.iter("node"):
    t = n.attrib.get("text") or ""
    if t:
        lines.append(f"{t!r} | {n.attrib.get('resource-id')} | click={n.attrib.get('clickable')} | {n.attrib.get('bounds')} | {n.attrib.get('class')}")
lines.append("=== DESCS ===")
for n in root.iter("node"):
    d = n.attrib.get("content-desc") or ""
    if d:
        lines.append(f"{d!r} | {n.attrib.get('resource-id')} | click={n.attrib.get('clickable')} | {n.attrib.get('bounds')}")
lines.append("=== CLICKABLE / IMAGE ===")
for n in root.iter("node"):
    cls = n.attrib.get("class") or ""
    rid = n.attrib.get("resource-id") or ""
    click = n.attrib.get("clickable")
    if click == "true" or "Image" in cls or rid:
        if rid or click == "true" or "Image" in cls:
            lines.append(f"{cls} | {rid} | click={click} | desc={n.attrib.get('content-desc')!r} | text={n.attrib.get('text')!r} | {n.attrib.get('bounds')}")

with open(out, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))
print(out)
