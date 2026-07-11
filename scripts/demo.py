"""Scripted walkthrough of Study Hub: verifies each feature and records a demo video."""
import asyncio
import sys
from playwright.async_api import async_playwright

URL = "http://localhost:8080"
VIDEO_DIR = "/tmp/demo-video"

async def pause(ms):
    await asyncio.sleep(ms / 1000)

async def type_slow(el, text):
    await el.click()
    await el.type(text, delay=45)

async def main():
    errors = []
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        ctx = await browser.new_context(
            viewport={"width": 1440, "height": 900},
            record_video_dir=VIDEO_DIR,
            record_video_size={"width": 1440, "height": 900},
        )
        page = await ctx.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)

        await page.goto(URL)
        await pause(2500)

        # ── 1. smart to-do list with auto time estimates ──
        todo_input = page.locator("#todo-input")
        await type_slow(todo_input, "read 30 pages of biology")
        await pause(1200)
        chip = await page.locator("#estimate-chip").inner_text()
        assert "75 min" in chip or "1h" in chip, f"estimate chip wrong: {chip}"
        await page.fill("#todo-date", "2026-07-14")
        await page.click("#todo-form button[type=submit]")
        await pause(1400)

        await type_slow(todo_input, "write 500 word history essay draft")
        await pause(1200)
        await page.fill("#todo-date", "2026-07-16")
        await page.click("#todo-form button[type=submit]")
        await pause(1400)

        await type_slow(todo_input, "reply to professor's email")
        await pause(1200)
        await page.click("#todo-form button[type=submit]")
        await pause(1200)

        count = await page.locator("#todo-count").inner_text()
        assert "left" in count, f"todo count wrong: {count}"

        # tick one off
        await page.locator(".todo-item .todo-check").last.click()
        await pause(1000)

        # ── 2. auto-plan the day ──
        await page.click("#auto-plan")
        await pause(2200)
        plan = await page.locator("#day-plan").inner_text()
        assert "break" in plan, f"plan missing breaks: {plan}"

        # ── 3. calendar synced with due dates ──
        cal_cells = page.locator(".cal-cell:not(.other)")
        n = await cal_cells.count()
        clicked = False
        for i in range(n):
            cell = cal_cells.nth(i)
            if await cell.locator(".evt-dot").count():
                await cell.click()
                clicked = True
                break
        assert clicked, "no calendar day had an event dot"
        await pause(1800)
        detail = await page.locator("#cal-day-detail").inner_text()
        assert "of work" in detail, f"day detail wrong: {detail}"

        # ── 4. study timer: start, run, skip into auto break ──
        await page.click("#timer-toggle")
        await pause(3200)
        t = await page.locator("#timer-time").inner_text()
        assert t < "25:00", f"timer not counting down: {t}"
        await page.click("#timer-skip")   # finishes focus → auto-starts short break
        await pause(2600)
        label = await page.locator("#timer-label").inner_text()
        assert "break" in label, f"break did not auto-start: {label}"
        await page.click("#timer-toggle")  # pause it for the rest of the demo
        await pause(800)

        # ── 5. lofi corner: switch playlist + ambience ──
        await page.locator(".preset").nth(1).click()
        await pause(2000)
        src = await page.locator("#lofi-frame").get_attribute("src")
        assert "4xDzrJKXOOY" in src, f"lofi src not switched: {src}"
        await page.click("#amb-rain")
        await pause(1500)
        assert "on" in (await page.locator("#amb-rain").get_attribute("class")), "rain toggle failed"

        # ── 6. sticky-note brainstorm board ──
        board = page.locator("#board")
        await board.scroll_into_view_if_needed()
        await pause(1200)

        await page.click("#add-note")
        await pause(800)
        await page.keyboard.type("mind map:\nchapter themes ✏️", delay=45)
        await pause(1000)

        # drag two notes around (grab the washi-tape top edge, not the textarea)
        for note_idx, (dx, dy) in [(0, (330, 150)), (1, (-60, 160))]:
            note = page.locator(".sticky").nth(note_idx)
            box = await note.bounding_box()
            sx, sy = box["x"] + box["width"] / 2, box["y"] + 12
            await page.mouse.move(sx, sy)
            await page.mouse.down()
            steps = 22
            for s in range(1, steps + 1):
                await page.mouse.move(sx + dx * s / steps, sy + dy * s / steps)
                await pause(20)
            await page.mouse.up()
            await pause(800)

        # verify a dragged position persisted to localStorage
        stored = await page.evaluate("localStorage.getItem('studyhub:notes')")
        assert stored and '"x"' in stored, "notes not persisted"

        # double-click empty board space to drop a note there
        bbox = await board.bounding_box()
        await page.mouse.dblclick(bbox["x"] + bbox["width"] - 220, bbox["y"] + bbox["height"] - 120)
        await pause(600)
        await page.keyboard.type("double-click = new note!", delay=40)
        await pause(1600)

        # ── closing shot: scroll back to top ──
        await page.evaluate("window.scrollTo({top: 0, behavior: 'smooth'})")
        await pause(2500)

        await ctx.close()
        await browser.close()

    if errors:
        print("PAGE ERRORS:", *errors, sep="\n  ")
        sys.exit(1)
    print("ALL CHECKS PASSED")

asyncio.run(main())
