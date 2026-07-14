"""
SayHi nearby like bot — fast + accurate.

Flow: search (15 min) -> open user -> photo -> bt_like -> back -> back
"""

from __future__ import annotations

import argparse
import os
import random
import subprocess
import sys
import time
from dataclasses import dataclass, field

from appium import webdriver
from appium.options.android import UiAutomator2Options
from appium.webdriver.common.appiumby import AppiumBy
from selenium.common.exceptions import NoSuchElementException, StaleElementReferenceException, TimeoutException
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

ADB = r"C:\platform-tools\adb.exe"
APPIUM_URL = os.environ.get("APPIUM_URL", "http://127.0.0.1:4723")
PACKAGE = "com.unearby.sayhi"
ACTIVITY = "com.unearby.sayhi.ChatrouletteNew"

LOGIN_WITHIN = "15 minutes"
INTEREST_IN = "MALE"
MAX_LIKES = 20
DELAY_MIN = 0.25
DELAY_MAX = 0.55
SKIP_ALREADY_LIKED = "you liked him"
# Match variants so we never open these or count them toward the N new likes
ALREADY_LIKED_NEEDLES = (
    "you liked him",
    "you like him",
    "liked him",
)
DRY_RUN = False
EXPLICIT_WAIT = 3.0
POLL = 0.12

# Set by GUI / caller to request a clean stop between profiles
STOP_FLAG = None  # threading.Event | None

ID_SEARCH = "com.unearby.sayhi:id/action_search"
ID_LOGIN_SPINNER = "com.unearby.sayhi:id/sp_time_appeared"
ID_SEARCH_OK = "com.unearby.sayhi:id/bt_ok"
ID_SEARCH_CANCEL = "com.unearby.sayhi:id/bt_cancel"
ID_LAST_SEEN = "com.unearby.sayhi:id/tv_last_seen"
ID_NAME = "android:id/text1"
ID_AVATAR = "android:id/icon"
ID_MSG_STATUS = "com.unearby.sayhi:id/tv_msg_status"
ID_DISPLAY_NAME = "com.unearby.sayhi:id/tv_display_name"
ID_START_CHAT = "com.unearby.sayhi:id/bt_start_chat"
ID_PHOTO_LIST = "com.unearby.sayhi:id/rv_photo_list"
ID_PROFILE_HEADER = "com.unearby.sayhi:id/profile_header"
ID_BT_LIKE = "com.unearby.sayhi:id/bt_like"
ID_TV_LIKE = "com.unearby.sayhi:id/tv_like"
ID_VP_PHOTO = "com.unearby.sayhi:id/vp_photo_list"

_WIN: dict | None = None


@dataclass
class Stats:
    liked: int = 0
    skipped_liked: int = 0
    errors: int = 0
    missed_like: int = 0
    seen_names: set[str] = field(default_factory=set)


def adb(*args: str) -> str:
    r = subprocess.run([ADB, *args], capture_output=True, text=True, check=False)
    return (r.stdout or "") + (r.stderr or "")


def require_device() -> str:
    out = adb("devices")
    devices = [
        ln.split("\t")[0]
        for ln in out.splitlines()
        if "\tdevice" in ln and not ln.startswith("List")
    ]
    if not devices:
        print("No phone in 'device' state.")
        sys.exit(1)
    print(f"Using device: {devices[0]}")
    return devices[0]


def win(driver) -> dict:
    global _WIN
    if _WIN is None:
        _WIN = driver.get_window_size()
    return _WIN


def tap_xy(driver, x: float, y: float) -> None:
    driver.execute_script("mobile: clickGesture", {"x": int(x), "y": int(y)})


def build_driver(device: str) -> webdriver.Remote:
    os.environ.setdefault("ANDROID_HOME", r"C:\platform-tools")
    os.environ["PATH"] = r"C:\platform-tools;" + os.environ.get("PATH", "")

    options = UiAutomator2Options()
    options.platform_name = "Android"
    options.automation_name = "UiAutomator2"
    options.device_name = device
    options.udid = device
    options.app_package = PACKAGE
    options.app_activity = ACTIVITY
    options.no_reset = True
    options.full_reset = False
    options.auto_grant_permissions = True
    options.new_command_timeout = 300
    options.skip_device_initialization = False
    options.set_capability("appium:dontStopAppOnReset", True)
    options.set_capability("appium:ignoreHiddenApiPolicyError", True)
    options.set_capability("appium:adbExecTimeout", 60000)
    options.set_capability("appium:disableWindowAnimation", True)
    options.set_capability(
        "appium:settings",
        {
            "waitForIdleTimeout": 0,
            "waitForSelectorTimeout": 800,
            "actionAcknowledgmentTimeout": 500,
            "scrollAcknowledgmentTimeout": 200,
            "idleTimeout": 0,
        },
    )

    print(f"Connecting to Appium at {APPIUM_URL} ...")
    driver = webdriver.Remote(APPIUM_URL, options=options)
    try:
        driver.update_settings(
            {
                "waitForIdleTimeout": 0,
                "waitForSelectorTimeout": 800,
                "actionAcknowledgmentTimeout": 500,
                "normalizeTagNames": True,
            }
        )
    except Exception:
        pass
    return driver


def wwait(driver, timeout: float = EXPLICIT_WAIT) -> WebDriverWait:
    return WebDriverWait(driver, timeout, poll_frequency=POLL)


def find_id(driver, rid: str, timeout: float = EXPLICIT_WAIT):
    return wwait(driver, timeout).until(EC.presence_of_element_located((AppiumBy.ID, rid)))


def click_id(driver, rid: str, timeout: float = EXPLICIT_WAIT) -> bool:
    try:
        el = wwait(driver, timeout).until(EC.element_to_be_clickable((AppiumBy.ID, rid)))
        el.click()
        return True
    except TimeoutException:
        return False


def quick_id(driver, rid: str):
    try:
        return driver.find_element(AppiumBy.ID, rid)
    except NoSuchElementException:
        return None


def has_id(driver, rid: str) -> bool:
    return quick_id(driver, rid) is not None


def tap_text(driver, text: str, timeout: float = 2.5, exact: bool = True) -> bool:
    sel = (
        f'new UiSelector().text("{text}")'
        if exact
        else f'new UiSelector().textContains("{text}")'
    )
    try:
        el = wwait(driver, timeout).until(
            EC.presence_of_element_located((AppiumBy.ANDROID_UIAUTOMATOR, sel))
        )
        el.click()
        return True
    except TimeoutException:
        return False


def on_list(driver) -> bool:
    return has_id(driver, ID_LAST_SEEN)


def on_profile(driver) -> bool:
    return has_id(driver, ID_START_CHAT) or has_id(driver, ID_DISPLAY_NAME)


def on_like_page(driver) -> bool:
    return has_id(driver, ID_BT_LIKE)


def pause_short(lo: float = 0.12, hi: float = 0.22) -> None:
    time.sleep(random.uniform(lo, hi))


def human_pause() -> None:
    time.sleep(random.uniform(DELAY_MIN, DELAY_MAX))


def screenshot(driver, name: str) -> None:
    path = os.path.join(os.path.dirname(__file__) or ".", "debug", name)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    driver.save_screenshot(path)
    print(f"  screenshot -> {path}")


def dismiss_search_if_open(driver) -> None:
    if has_id(driver, ID_SEARCH_CANCEL):
        click_id(driver, ID_SEARCH_CANCEL, timeout=1.5)
        pause_short()


def run_search(driver) -> None:
    dismiss_search_if_open(driver)
    if not click_id(driver, ID_SEARCH, timeout=3):
        driver.find_element(AppiumBy.ACCESSIBILITY_ID, "Search").click()
    find_id(driver, ID_LOGIN_SPINNER, timeout=4)

    try:
        male = driver.find_element(AppiumBy.ACCESSIBILITY_ID, "Male")
        if male.get_attribute("clickable") == "true":
            male.click()
    except NoSuchElementException:
        pass

    sp = driver.find_element(AppiumBy.ID, ID_LOGIN_SPINNER)
    current = ""
    try:
        current = sp.find_element(AppiumBy.ID, "android:id/text1").text or ""
    except NoSuchElementException:
        current = sp.text or ""

    if LOGIN_WITHIN.lower() not in current.lower():
        sp.click()
        pause_short(0.15, 0.25)
        if not tap_text(driver, LOGIN_WITHIN, timeout=2.5, exact=True):
            raise RuntimeError(f"Could not select {LOGIN_WITHIN}")

    if not click_id(driver, ID_SEARCH_OK, timeout=2.5):
        raise RuntimeError("SEARCH failed")
    try:
        find_id(driver, ID_LAST_SEEN, timeout=8)
    except TimeoutException:
        print("warn: list slow to appear")
    print("Search ready")


def _mid_y(el) -> float:
    r = el.rect
    return r["y"] + r["height"] / 2.0


def is_already_liked_text(text: str) -> bool:
    low = (text or "").lower()
    return any(n in low for n in ALREADY_LIKED_NEEDLES)


def already_liked_ys(driver) -> list[float]:
    """Y centers of on-screen 'you liked him' labels (any TextView)."""
    ys: list[float] = []
    for needle in ("liked him", "Liked him", "You liked"):
        try:
            els = driver.find_elements(
                AppiumBy.ANDROID_UIAUTOMATOR,
                f'new UiSelector().textContains("{needle}")',
            )
        except Exception:
            continue
        for el in els:
            try:
                ys.append(_mid_y(el))
            except StaleElementReferenceException:
                continue
    return ys


def list_candidates(driver) -> list[tuple[str, float, float, str, bool]]:
    """Returns (name, x, y, blob, already_liked). Only fresh rows count toward N likes."""
    try:
        lasts = driver.find_elements(AppiumBy.ID, ID_LAST_SEEN)
        names = driver.find_elements(AppiumBy.ID, ID_NAME)
        icons = driver.find_elements(AppiumBy.ID, ID_AVATAR)
        statuses = driver.find_elements(AppiumBy.ID, ID_MSG_STATUS)
    except StaleElementReferenceException:
        return []

    liked_y = already_liked_ys(driver)

    def pack(els):
        out = []
        for el in els:
            try:
                out.append((_mid_y(el), el))
            except StaleElementReferenceException:
                continue
        out.sort(key=lambda t: t[0])
        return out

    lasts_p = pack(lasts)
    names_p = pack(names)
    icons_p = pack(icons)
    status_p = pack(statuses)

    def nearest(pool, y, tol=100.0):
        best = None
        best_d = tol
        for py, el in pool:
            d = abs(py - y)
            if d < best_d:
                best_d = d
                best = el
        return best

    rows: list[tuple[str, float, float, str, bool]] = []
    size = win(driver)
    for y, ls in lasts_p:
        try:
            blob = (ls.text or "").strip()
            name_el = nearest(names_p, y, 95)
            name = (name_el.text or "").strip() if name_el is not None else "?"
            if name_el is not None:
                blob += " | " + name

            st = nearest(status_p, y, 95)
            if st is not None:
                t = (st.text or "").strip()
                if t:
                    blob += " | " + t

            icon = nearest(icons_p, y, 120)
            if icon is not None:
                r = icon.rect
                if r["height"] < 30:
                    continue
                x = r["x"] + r["width"] / 2
                yy = r["y"] + r["height"] / 2
            else:
                x = 100.0
                yy = y

            if yy < 100 or yy > size["height"] - 80:
                continue

            near_liked_label = any(abs(ly - yy) < 110 or abs(ly - y) < 110 for ly in liked_y)
            already = near_liked_label or is_already_liked_text(blob)
            rows.append((name, x, yy, blob, already))
        except StaleElementReferenceException:
            continue

    fresh = sum(1 for r in rows if not r[4])
    liked_n = sum(1 for r in rows if r[4])
    print(f"  rows: {len(rows)} (new={fresh}, already_liked={liked_n})")
    return rows


def read_like_count(driver) -> int | None:
    el = quick_id(driver, ID_TV_LIKE)
    if el is None:
        return None
    try:
        t = (el.text or "").strip()
        return int(t) if t.isdigit() else None
    except Exception:
        return None


def open_photo_viewer(driver) -> bool:
    if on_like_page(driver):
        return True
    if not on_profile(driver):
        return False

    try:
        el = driver.find_element(
            AppiumBy.ANDROID_UIAUTOMATOR,
            f'new UiSelector().resourceId("{ID_PHOTO_LIST}").childSelector(new UiSelector().clickable(true).instance(0))',
        )
        el.click()
        pause_short(0.18, 0.28)
        if on_like_page(driver):
            return True
    except NoSuchElementException:
        pass

    size = win(driver)
    tap_xy(driver, size["width"] * 0.5, min(size["width"], size["height"] * 0.5) * 0.45)
    pause_short(0.2, 0.32)
    try:
        find_id(driver, ID_BT_LIKE, timeout=2.5)
        return True
    except TimeoutException:
        return False


def tap_heart(driver) -> bool:
    if DRY_RUN:
        print("  DRY_RUN: skip heart")
        return True

    before = read_like_count(driver)
    btn = quick_id(driver, ID_BT_LIKE)
    if btn is None:
        try:
            btn = find_id(driver, ID_BT_LIKE, timeout=2)
        except TimeoutException:
            return False

    try:
        btn.click()
    except Exception:
        r = btn.rect
        tap_xy(driver, r["x"] + r["width"] / 2, r["y"] + r["height"] / 2)

    pause_short(0.15, 0.28)

    after = read_like_count(driver)
    if before is not None and after is not None and after > before:
        print(f"  heart ok (count {before}->{after})")
        return True
    if has_id(driver, ID_BT_LIKE) or on_like_page(driver) or on_profile(driver):
        print("  heart tapped (bt_like)")
        return True
    return False


def return_to_list(driver) -> None:
    for _ in range(3):
        if on_list(driver):
            return
        if on_like_page(driver):
            driver.back()
            pause_short(0.12, 0.2)
            continue
        if on_profile(driver):
            driver.back()
            pause_short(0.12, 0.2)
            continue
        driver.back()
        pause_short(0.12, 0.2)
    if not on_list(driver):
        try:
            driver.find_element(AppiumBy.ACCESSIBILITY_ID, "find").click()
        except NoSuchElementException:
            pass


def like_current_profile(driver, expected_name: str) -> bool:
    disp = quick_id(driver, ID_DISPLAY_NAME)
    if disp is not None:
        got = (disp.text or "").strip()
        if expected_name and got and got.lower() != expected_name.lower():
            print(f"  name mismatch want={expected_name!r} got={got!r}")
            return False

    if not open_photo_viewer(driver):
        print("  fail: like page")
        screenshot(driver, "no_like_page.png")
        return False

    if not has_id(driver, ID_BT_LIKE):
        print("  fail: no bt_like")
        return False

    return tap_heart(driver)


def scroll_list(driver, soft: bool = True, skip_cluster: bool = False) -> None:
    """
    soft: ~1 row nudge (finding more in place)
    skip_cluster: faster jump when the whole screen is already-liked
    """
    size = win(driver)
    left = int(size["width"] * 0.2)
    width = int(size["width"] * 0.6)
    if skip_cluster:
        top = int(size["height"] * 0.48)
        height = int(size["height"] * 0.22)
        percent = 0.55
    elif soft:
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
    pause_short(0.25 if skip_cluster else 0.35, 0.4 if skip_cluster else 0.5)


def should_stop() -> bool:
    return STOP_FLAG is not None and STOP_FLAG.is_set()


def like_loop(driver, stats: Stats) -> None:
    """
    Keep going until MAX_LIKES *new* hearts succeed.
    Already-liked rows are never opened and never count toward the total.
    """
    idle_scrolls = 0
    max_idle = 40  # allow scanning through long streaks of already-liked
    while stats.liked < MAX_LIKES and idle_scrolls < max_idle:
        if should_stop():
            print("stop requested")
            return
        if not on_list(driver):
            return_to_list(driver)

        candidates = list_candidates(driver)
        target = None
        skipped_here = 0
        for name, x, y, blob, already in candidates:
            key = name.strip().lower()
            if not key or key == "?":
                continue
            if already or is_already_liked_text(blob):
                if key not in stats.seen_names:
                    stats.skipped_liked += 1
                    stats.seen_names.add(key)
                    print(f"skip already-liked: {name}")
                skipped_here += 1
                continue
            if key in stats.seen_names:
                continue
            target = (name, x, y, key)
            break

        remaining = MAX_LIKES - stats.liked
        print(
            f"  progress: {stats.liked}/{MAX_LIKES} new likes "
            f"(need {remaining} more, skipped_liked_total={stats.skipped_liked})"
        )

        if target is None:
            # Screen has only already-liked / seen → jump past them faster
            if skipped_here > 0 or (candidates and all(c[4] or c[0].strip().lower() in stats.seen_names for c in candidates)):
                print("skip-cluster scroll (all visible already liked/seen)...")
                scroll_list(driver, skip_cluster=True)
            else:
                print("soft scroll...")
                scroll_list(driver, soft=True)
            idle_scrolls += 1
            # Skipping already-liked is progress — don't give up early
            if skipped_here > 0:
                idle_scrolls = max(0, idle_scrolls - 1)
            continue

        idle_scrolls = 0
        name, x, y, key = target
        print(f"open NEW: {name}")
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
                print(f"  liked NEW ({stats.liked}/{MAX_LIKES})")
                human_pause()
            else:
                stats.missed_like += 1
                print("  NOT liked")
        except Exception as e:
            print(f"  error: {e}")
            stats.errors += 1
            screenshot(driver, f"error_{stats.errors}.png")
            return_to_list(driver)


def run_bot(
    max_likes: int = 20,
    delay_min: float = 0.25,
    delay_max: float = 0.55,
    login_within: str = "15 minutes",
    skip_search: bool = False,
    dry_run: bool = False,
    stop_flag=None,
) -> Stats:
    """Programmatic entry (GUI / scripts)."""
    global MAX_LIKES, DRY_RUN, DELAY_MIN, DELAY_MAX, LOGIN_WITHIN, STOP_FLAG
    MAX_LIKES = max_likes
    DELAY_MIN = delay_min
    DELAY_MAX = max(delay_max, delay_min)
    LOGIN_WITHIN = login_within
    DRY_RUN = dry_run
    STOP_FLAG = stop_flag

    print("=== SayHi bot (fast) ===")
    print(f"max={MAX_LIKES} delay={DELAY_MIN}-{DELAY_MAX}s login_within={LOGIN_WITHIN} dry_run={DRY_RUN}")

    device = require_device()
    driver = build_driver(device)
    stats = Stats()
    t0 = time.time()
    try:
        pause_short(0.3, 0.5)
        dismiss_search_if_open(driver)
        if should_stop():
            return stats
        if not skip_search:
            run_search(driver)
        elif not on_list(driver):
            run_search(driver)
        if not should_stop():
            like_loop(driver, stats)
    finally:
        dt = time.time() - t0
        print("--- done ---")
        print(
            f"liked={stats.liked} missed={stats.missed_like} "
            f"skipped_liked={stats.skipped_liked} errors={stats.errors} "
            f"time={dt:.1f}s"
        )
        try:
            driver.quit()
        except Exception:
            pass
    return stats


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--max", type=int, default=MAX_LIKES)
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--delay-min", type=float, default=DELAY_MIN)
    p.add_argument("--delay-max", type=float, default=DELAY_MAX)
    p.add_argument("--login-within", type=str, default=LOGIN_WITHIN)
    p.add_argument("--skip-search", action="store_true", help="already on filtered list")
    args = p.parse_args()
    run_bot(
        max_likes=args.max,
        delay_min=args.delay_min,
        delay_max=args.delay_max,
        login_within=args.login_within,
        skip_search=args.skip_search,
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    main()
