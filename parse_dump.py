import xml.etree.ElementTree as ET

tree = ET.parse(r"C:\Users\shiver\Desktop\cjj\window_dump.xml")
root = tree.getroot()
print("=== TEXTS ===")
for n in root.iter("node"):
    t = n.attrib.get("text") or ""
    if not t:
        continue
    print(
        repr(t),
        "|",
        n.attrib.get("resource-id"),
        "| clickable=",
        n.attrib.get("clickable"),
        "|",
        n.attrib.get("bounds"),
    )

print("=== DESCS ===")
for n in root.iter("node"):
    d = n.attrib.get("content-desc") or ""
    if not d:
        continue
    print(
        repr(d),
        "|",
        n.attrib.get("resource-id"),
        "|",
        n.attrib.get("bounds"),
        "| clickable=",
        n.attrib.get("clickable"),
    )

print("=== RESOURCE IDS ===")
seen = set()
for n in root.iter("node"):
    r = n.attrib.get("resource-id") or ""
    if not r or r in seen:
        continue
    seen.add(r)
    print(r, n.attrib.get("class"), n.attrib.get("bounds"))
