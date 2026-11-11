from onethread.agent.cites import CiteParser
from onethread.agent.events import TextEv


def test_marker_split_across_chunks():
    p = CiteParser({"IQC-5531"})
    out = p.feed("Cpk 0.92 [[ci") + p.feed("te:IQC-5531]] xong") + p.flush()
    assert [e.type for e in out] == ["text", "cite", "text"]
    assert out[1].target_id == "IQC-5531"


def test_unknown_id_has_null_target():   # Review Focus #3
    out = CiteParser(set()).feed("x [[cite:IQC-9999]]")
    assert out[-1].type == "cite" and out[-1].target_id is None
    assert out[-1].label == "IQC-9999"


def test_text_is_never_lost_or_reordered():
    p = CiteParser({"A"})
    chunks = ["Một [", "[cite:A]", "] hai [x] [[ba", "d"]
    out = []
    for c in chunks:
        out += p.feed(c)
    out += p.flush()
    text = "".join(e.text for e in out if e.type == "text")
    assert text == "Một  hai [x] [[bad"
    assert [e.label for e in out if e.type == "cite"] == ["A"]


def test_flush_releases_dangling_partial_marker_as_text():
    p = CiteParser(set())
    assert p.feed("xong [[cit") == [TextEv("xong ")]
    assert p.flush() == [TextEv("[[cit")]


def test_text_ev_positional():
    assert TextEv("a").text == "a" and TextEv("a").type == "text"
