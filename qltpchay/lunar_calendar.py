"""Vietnamese lunar calendar conversion (UTC+7), based on Ho Ngoc Duc's algorithm."""

from __future__ import annotations

import math
from datetime import date, timedelta


_TIME_ZONE = 7.0
PREORDER_REMINDER_WINDOW_DAYS = 7


def _julian_day(day: int, month: int, year: int) -> int:
    a = (14 - month) // 12
    y = year + 4800 - a
    m = month + 12 * a - 3
    jd = day + (153 * m + 2) // 5 + 365 * y + y // 4 - y // 100 + y // 400 - 32045
    if jd < 2299161:
        jd = day + (153 * m + 2) // 5 + 365 * y + y // 4 - 32083
    return jd


def _new_moon(k: int) -> float:
    """Julian day number of the k-th new moon (Meeus approximation)."""
    t = k / 1236.85
    t2 = t * t
    t3 = t2 * t
    dr = math.pi / 180
    jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * t2 - 0.000000155 * t3
    jd1 += 0.00033 * math.sin((166.56 + 132.87 * t - 0.009173 * t2) * dr)
    m = 359.2242 + 29.10535608 * k - 0.0000333 * t2 - 0.00000347 * t3
    m_pr = 306.0253 + 385.81691806 * k + 0.0107306 * t2 + 0.00001236 * t3
    f = 21.2964 + 390.67050646 * k - 0.0016528 * t2 - 0.00000239 * t3
    c1 = (0.1734 - 0.000393 * t) * math.sin(m * dr) + 0.0021 * math.sin(2 * m * dr)
    c1 += -0.4068 * math.sin(m_pr * dr) + 0.0161 * math.sin(2 * m_pr * dr)
    c1 -= 0.0004 * math.sin(3 * m_pr * dr)
    c1 += 0.0104 * math.sin(2 * f * dr) - 0.0051 * math.sin((m + m_pr) * dr)
    c1 += -0.0074 * math.sin((m - m_pr) * dr) + 0.0004 * math.sin((2 * f + m) * dr)
    c1 += -0.0004 * math.sin((2 * f - m) * dr) - 0.0006 * math.sin((2 * f + m_pr) * dr)
    c1 += 0.0010 * math.sin((2 * f - m_pr) * dr) + 0.0005 * math.sin((2 * m_pr + m) * dr)
    if t < -11:
        delta_t = 0.001 + 0.000839 * t + 0.0002261 * t2 - 0.00000845 * t3 - 0.000000081 * t * t3
    else:
        delta_t = -0.000278 + 0.000265 * t + 0.000262 * t2
    return jd1 + c1 - delta_t


def _new_moon_day(k: int) -> int:
    return math.floor(_new_moon(k) + 0.5 + _TIME_ZONE / 24)


def _sun_longitude_sector(jdn: int) -> int:
    t = (jdn - 2451545.5 - _TIME_ZONE / 24) / 36525
    t2 = t * t
    dr = math.pi / 180
    m = 357.52910 + 35999.05030 * t - 0.0001559 * t2 - 0.00000048 * t * t2
    l0 = 280.46645 + 36000.76983 * t + 0.0003032 * t2
    dl = (1.914600 - 0.004817 * t - 0.000014 * t2) * math.sin(dr * m)
    dl += (0.019993 - 0.000101 * t) * math.sin(2 * dr * m) + 0.000290 * math.sin(3 * dr * m)
    longitude = (l0 + dl) * dr
    longitude -= math.pi * 2 * math.floor(longitude / (math.pi * 2))
    return math.floor(longitude / math.pi * 6)


def _lunar_month_11(year: int) -> int:
    off = _julian_day(31, 12, year) - 2415021
    k = math.floor(off / 29.530588853)
    nm = _new_moon_day(k)
    if _sun_longitude_sector(nm) >= 9:
        nm = _new_moon_day(k - 1)
    return nm


def _leap_month_offset(a11: int) -> int:
    k = math.floor((a11 - 2415021.076998695) / 29.530588853 + 0.5)
    last = 0
    i = 1
    arc = _sun_longitude_sector(_new_moon_day(k + i))
    while arc != last and i < 14:
        last = arc
        i += 1
        arc = _sun_longitude_sector(_new_moon_day(k + i))
    return i - 1


def solar_to_vietnamese_lunar(solar_date: date) -> tuple[int, int, int, bool]:
    """Return (lunar day, lunar month, lunar year, is_leap_month) for a date."""
    if not isinstance(solar_date, date):
        raise TypeError("solar_date must be a datetime.date")
    day, month, year = solar_date.day, solar_date.month, solar_date.year
    day_number = _julian_day(day, month, year)
    k = math.floor((day_number - 2415021.076998695) / 29.530588853)
    month_start = _new_moon_day(k + 1)
    if month_start > day_number:
        month_start = _new_moon_day(k)
    a11 = _lunar_month_11(year)
    b11 = a11
    if a11 >= month_start:
        lunar_year = year
        a11 = _lunar_month_11(year - 1)
    else:
        lunar_year = year + 1
        b11 = _lunar_month_11(year + 1)
    lunar_day = day_number - month_start + 1
    diff = math.floor((month_start - a11) / 29)
    lunar_month = diff + 11
    leap = False
    if b11 - a11 > 365:
        leap_diff = _leap_month_offset(a11)
        if diff >= leap_diff:
            lunar_month = diff + 10
            if diff == leap_diff:
                leap = True
    if lunar_month > 12:
        lunar_month -= 12
    if lunar_month >= 11 and diff < 4:
        lunar_year -= 1
    return lunar_day, lunar_month, lunar_year, leap


def next_preorder_lunar_date(solar_date: date) -> tuple[int, int, int, int, bool]:
    """Return days until and lunar date of the next lunar 1st or 15th, including today."""
    if not isinstance(solar_date, date):
        raise TypeError("solar_date must be a datetime.date")
    # #Issue179: Đếm tới mùng 1 hoặc 15 tiếp theo để chỉ nhắc trong cửa sổ đặt trước.
    for days_until in range(32):
        candidate_date = solar_date + timedelta(days=days_until)
        lunar_day, lunar_month, lunar_year, is_leap_month = solar_to_vietnamese_lunar(candidate_date)
        if lunar_day in (1, 15):
            return days_until, lunar_day, lunar_month, lunar_year, is_leap_month
    raise RuntimeError("Không tìm thấy ngày mùng 1 hoặc 15 âm lịch kế tiếp trong khoảng tìm kiếm.")
