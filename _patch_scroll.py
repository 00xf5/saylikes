from pathlib import Path

p = Path(r"C:\Users\shiver\Desktop\cjj\sayhi_bot.py")
text = p.read_text(encoding="utf-8")
start = text.index("def scroll_list")
end = text.index("def main()")
new = '''def scroll_list(driver, soft: bool = True) -> None:
    """Tiny fling (~1 row) so we don't jump past people."""
    size = win(driver)
    left = int(size["width"] * 0.2)
    width = int(size["width"] * 0.6)
    if soft:
        top = int(size["height"] * 0.55)
        height = int(size["height"] * 0.14)
        percent = 0.35
    else:
        top = int(size["height"] * 0.52)
        height = int(size["height"] * 0.18)
        percent = 0.45
    driver.execute_script(
        "mobile: swipeGesture",
        {
            "left": left,
            "top": top,
            "width": width,
            "height": height,
            "direction": "up",
            "percent": percent,
        },
    )
    pause_short(0.35, 0.5)


def like_loop(driver, stats: Stats) -> None:
    idle_scrolls = 0
    max_idle = 24
    while stats.liked < MAX_LIKES and idle_scrolls < max_idle:
        if not on_list(driver):
            return_to_list(driver)

        # Rescan after every like — list shifts; never reuse stale coords
        candidates = list_candidates(driver)
        target = None
        for name, x, y, blob in candidates:
            key = name.strip().lower()
            if not key or key == "?" or key in stats.seen_names:
                continue
            if SKIP_ALREADY_LIKED.lower() in blob.lower():
                stats.skipped_liked += 1
                stats.seen_names.add(key)
                print(f"skip liked: {name}")
                continue
            target = (name, x, y, key)
            break

        if target is None:
            print("soft scroll...")
            scroll_list(driver, soft=True)
            idle_scrolls += 1
            if idle_scrolls % 5 == 0:
                scroll_list(driver, soft=False)
            continue

        idle_scrolls = 0
        name, x, y, key = target
        print(f"open: {name}")
        tap_xy(driver, x, y)
        pause_short(0.25, 0.4)

        try:
            find_id(driver, ID_DISPLAY_NAME, timeout=2.5)
        except TimeoutException:
            if not on_profile(driver):
                print("  fail: no profile")
                stats.errors += 1
                stats.seen_names.add(key)
                return_to_list(driver)
                continue

        stats.seen_names.add(key)
        try:
            ok = like_current_profile(driver, name)
            return_to_list(driver)
            if ok:
                stats.liked += 1
                print(f"  liked ({stats.liked}/{MAX_LIKES})")
                human_pause()
            else:
                stats.missed_like += 1
                print("  NOT liked")
        except Exception as e:
            print(f"  error: {e}")
            stats.errors += 1
            screenshot(driver, f"error_{stats.errors}.png")
            return_to_list(driver)


'''
p.write_text(text[:start] + new + text[end:], encoding="utf-8")
print("ok")
