"""Deterministic volume generator: 1,000 serials, 42 boxes, press-cycle and side events. Pure, no I/O."""

import random
from dataclasses import dataclass, field
from datetime import datetime, timedelta

HOURLY_TEMPS = [26.2, 26.5, 26.8, 26.9, 26.6]


@dataclass
class Volume:
    objects: list[dict] = field(default_factory=list)
    links: list[dict] = field(default_factory=list)
    events: list[dict] = field(default_factory=list)


def _link(from_id: str, to_id: str, relation: str, evidence: dict | None = None) -> dict:
    return {
        "from_id": from_id,
        "to_id": to_id,
        "relation": relation,
        "tier": 1,
        "status": "confirmed",
        "score": 1.0,
        "rule_version": "T1-exact",
        "evidence": evidence or {},
    }


def _press_event(n: int, when: datetime, object_ids: list[str], lot: str, cycle_s: float,
                 force_kn: float, plc_offset_s: float) -> dict:
    return {
        "event_id": f"EV-PLC2-{n:06d}",
        "type": "press_cycle",
        "object_ids": object_ids,
        "event_time": when,
        "time_kind": "sensor",
        "source": "PLC2",
        "source_record_id": f"PLC2-{n:06d}",
        "payload": {
            "cycle_s": round(cycle_s, 3),
            "peak_force_kn": round(force_kn, 3),
            "lot": lot,
            "plc_time": (when + timedelta(seconds=plc_offset_s)).isoformat(),
        },
    }


def _side_events(vol: dict) -> list[dict]:
    day = datetime.fromisoformat(vol["lot_b_start"]).replace(hour=0, minute=0, second=0)
    tz = day.tzinfo

    def at(y, mo, d, h, mi=0) -> datetime:
        return datetime(y, mo, d, h, mi, tzinfo=tz)

    events = [
        {
            "event_id": "EV-PM-0241", "type": "maintenance", "object_ids": ["M02"],
            "event_time": at(2026, 10, 20, 9), "time_kind": "transaction", "source": "CMMS",
            "source_record_id": "PM-0241", "payload": {"result": "normal"},
        },
        {
            "event_id": "EV-SHIFT-1103", "type": "shift", "object_ids": ["M02"],
            "event_time": at(2026, 11, 3, 12), "time_kind": "transaction", "source": "HR",
            "source_record_id": "HR-SHIFT-1103",
            "payload": {"operator": "NV-118", "shift": "Shift 2", "start": "12:00", "end": "20:00",
                        "changed": False},
        },
        {
            "event_id": "EV-RCV-2810", "type": "goods_receipt", "object_ids": ["LOT-B", "PO-4410"],
            "event_time": at(2026, 10, 28, 9, 10), "time_kind": "transaction", "source": "WMS",
            "source_record_id": "RCV-2810", "payload": {"lot": "LOT-B", "qty": 5000},
        },
        {
            "event_id": "EV-ISS-1103", "type": "lot_loaded", "object_ids": ["LOT-B", "HOP-1"],
            "event_time": datetime.fromisoformat(vol["lot_b_start"]), "time_kind": "transaction",
            "source": "WMS", "source_record_id": "ISS-1103", "payload": {"lot": "LOT-B"},
        },
    ]
    for i, temp in enumerate(HOURLY_TEMPS):
        hour = 12 + i
        events.append({
            "event_id": f"EV-ENV-L1-{hour:02d}", "type": "env_temp", "object_ids": ["LINE-1"],
            "event_time": at(2026, 11, 3, hour), "time_kind": "sensor", "source": "ENV-L1",
            "source_record_id": f"ENV-L1-{hour:02d}00", "payload": {"temp_c": temp},
        })
    return events


def generate_volume(story: dict, seed: int = 42) -> Volume:
    vol = story["volume"]
    rng = random.Random(seed)
    v = Volume()

    n_parts = vol["n_parts"]
    prefix = vol["serial_prefix"]
    plc_offset = vol["plc_offset_s"]
    noise_c, noise_f = vol["cycle_noise_s"], vol["force_noise_kn"]
    lot_b_start = datetime.fromisoformat(vol["lot_b_start"])
    lot_a_start = datetime.fromisoformat(vol["lot_a_start"])

    # --- LOT-A press cycles (reference), from lot_a_start until LOT-B is loaded ---
    n = 0
    when = lot_a_start
    step_a = timedelta(seconds=vol["lot_a_cycle_s"])
    while when < lot_b_start:
        n += 1
        v.events.append(_press_event(
            n, when, ["M02"], "LOT-A",
            vol["lot_a_cycle_s"] + rng.uniform(-noise_c, noise_c),
            vol["force_kn"]["LOT-A"] + rng.uniform(-noise_f, noise_f), plc_offset))
        when += step_a

    # --- LOT-B press cycles; serial label order: cycle 19 is MH20-0001, the rest follow by cycle index ---
    first = vol["serial0001_cycle_index"]
    cycle_order = [first] + [i for i in range(n_parts) if i != first]
    serial_of_cycle = {cycle: f"{prefix}{k:04d}" for k, cycle in enumerate(cycle_order, start=1)}
    for i in range(n_parts):
        n += 1
        serial = serial_of_cycle[i]
        v.events.append(_press_event(
            n, lot_b_start + timedelta(seconds=i * vol["lot_b_cycle_s"]), ["M02", serial], "LOT-B",
            vol["lot_b_cycle_s"] + rng.uniform(-noise_c, noise_c),
            vol["force_kn"]["LOT-B"] + rng.uniform(-noise_f, noise_f), plc_offset))
        v.objects.append({"object_id": serial, "type": "serial", "name": serial,
                          "attributes": {"stage": "san_xuat"}})

    # --- boxes and shipments, assigned in serial label order ---
    labels = [f"{prefix}{k:04d}" for k in range(1, n_parts + 1)]
    event_of = {e["object_ids"][1]: e["source_record_id"] for e in v.events if len(e["object_ids"]) > 1}
    pos, box_no = 0, 0
    for shp in vol["shipments"]:
        per_box, extra = divmod(shp["parts"], shp["boxes"])
        for b in range(shp["boxes"]):
            box_no += 1
            box_id = f"BOX-{box_no:03d}"
            size = per_box + (extra if b == 0 else 0)
            v.objects.append({"object_id": box_id, "type": "box", "name": box_id,
                              "attributes": {"shipment": shp["id"], "parts": size, "stage": "logistics"}})
            v.links.append(_link(box_id, shp["id"], "shipped_in"))
            for serial in labels[pos:pos + size]:
                v.links.append(_link(serial, "LOT-B", "uses_lot"))
                v.links.append(_link(serial, "M02", "processed_on",
                                     {"source_record_id": event_of[serial]}))
                v.links.append(_link(serial, box_id, "packed_in"))
                v.links.append(_link(serial, shp["id"], "shipped_in"))
            pos += size

    v.events.extend(_side_events(vol))
    return v
