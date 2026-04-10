use pulldown_cmark::{Event, Options, Parser, Tag, TagEnd, HeadingLevel};
use std::collections::VecDeque;

use crate::types::{Block, generate_block_id};

/// 将 HeadingLevel 转为 u8
fn heading_level_to_u8(level: HeadingLevel) -> u8 {
    match level {
        HeadingLevel::H1 => 1,
        HeadingLevel::H2 => 2,
        HeadingLevel::H3 => 3,
        HeadingLevel::H4 => 4,
        HeadingLevel::H5 => 5,
        HeadingLevel::H6 => 6,
    }
}

/// 将 Markdown 源码解析为 Block 列表
pub fn parse_markdown(source: &str) -> Vec<Block> {
    let mut options = Options::empty();
    options.insert(Options::ENABLE_STRIKETHROUGH);

    let parser = Parser::new_ext(source, options);
    let events: Vec<Event> = parser.collect();

    let mut blocks: Vec<Block> = Vec::new();
    let mut line_number = 0;
    let mut i = 0;

    while i < events.len() {
        match &events[i] {
            Event::Start(Tag::Heading { level, .. }) => {
                let lvl = *level;
                let content = collect_text_until_tag_end(&events, &mut i, TagEnd::Heading(lvl));
                let id = generate_block_id(line_number, &content);
                blocks.push(Block::Heading {
                    id,
                    content,
                    level: heading_level_to_u8(lvl),
                });
                line_number += 1;
            }
            Event::Start(Tag::List(start_number)) => {
                let is_ordered = start_number.is_some();
                let mut list_items = Vec::new();
                i += 1; // skip Start(List)
                let mut item_index: u32 = 0;

                while i < events.len() {
                    match &events[i] {
                        Event::Start(Tag::Item) => {
                            i += 1; // skip Start(Item)
                            let content = collect_text_until_tag_end(&events, &mut i, TagEnd::Item);
                            item_index += 1;
                            list_items.push((content, is_ordered, if is_ordered { Some(item_index) } else { None }));
                        }
                        Event::End(TagEnd::List(_)) => {
                            i += 1;
                            break;
                        }
                        _ => {
                            i += 1;
                        }
                    }
                }

                for (content, ordered, index) in list_items {
                    let id = generate_block_id(line_number, &content);
                    blocks.push(Block::ListItem {
                        id,
                        content,
                        ordered,
                        index,
                    });
                    line_number += 1;
                }
            }
            Event::Start(Tag::CodeBlock(kind)) => {
                let language = match kind {
                    pulldown_cmark::CodeBlockKind::Fenced(lang) => {
                        let lang_str = lang.to_string();
                        if lang_str.is_empty() {
                            None
                        } else {
                            Some(lang_str)
                        }
                    }
                    pulldown_cmark::CodeBlockKind::Indented => None,
                };
                let content = collect_code_block_content(&events, &mut i);
                let line_count = content.lines().count().max(1);
                let id = generate_block_id(line_number, &content);
                blocks.push(Block::Code {
                    id,
                    content,
                    language,
                });
                line_number += line_count;
            }
            Event::Start(Tag::BlockQuote(_)) => {
                let content = collect_text_until_tag_end(&events, &mut i, TagEnd::BlockQuote(None));
                let id = generate_block_id(line_number, &content);
                blocks.push(Block::Blockquote { id, content });
                line_number += 1;
            }
            Event::Rule => {
                let id = generate_block_id(line_number, "---");
                blocks.push(Block::ThematicBreak { id });
                line_number += 1;
                i += 1;
            }
            Event::Text(text) => {
                let trimmed = text.to_string();
                if !trimmed.is_empty() {
                    let id = generate_block_id(line_number, &trimmed);
                    blocks.push(Block::Paragraph {
                        id,
                        content: trimmed,
                    });
                    line_number += 1;
                }
                i += 1;
            }
            Event::Start(Tag::Paragraph) => {
                let content = collect_paragraph_text(&events, &mut i);
                if !content.is_empty() {
                    let id = generate_block_id(line_number, &content);
                    blocks.push(Block::Paragraph {
                        id,
                        content,
                    });
                    line_number += 1;
                }
            }
            Event::SoftBreak | Event::HardBreak => {
                if blocks.last().map_or(true, |b| !matches!(b, Block::Empty { .. })) {
                    let id = generate_block_id(line_number, "");
                    blocks.push(Block::Empty { id });
                    line_number += 1;
                }
                i += 1;
            }
            _ => {
                i += 1;
            }
        }
    }

    // 去除末尾多余的空 block
    while blocks.last().map_or(false, |b| matches!(b, Block::Empty { .. })) {
        blocks.pop();
    }

    blocks
}

/// 收集文本直到遇到指定的 TagEnd
fn collect_text_until_tag_end(
    events: &[Event],
    i: &mut usize,
    expected_end: TagEnd,
) -> String {
    let mut text_parts: VecDeque<String> = VecDeque::new();
    *i += 1; // skip Start tag

    while *i < events.len() {
        match &events[*i] {
            Event::End(end) if std::mem::discriminant(end) == std::mem::discriminant(&expected_end) => {
                *i += 1;
                break;
            }
            Event::Text(t) => {
                text_parts.push_back(t.to_string());
                *i += 1;
            }
            Event::SoftBreak => {
                text_parts.push_back("\n".to_string());
                *i += 1;
            }
            Event::Code(c) => {
                text_parts.push_back(format!("`{}`", c));
                *i += 1;
            }
            Event::Start(Tag::Emphasis) => {
                *i += 1;
                let inner = collect_until_end(events, i, TagEnd::Emphasis);
                text_parts.push_back(format!("*{}*", inner));
            }
            Event::Start(Tag::Strong) => {
                *i += 1;
                let inner = collect_until_end(events, i, TagEnd::Strong);
                text_parts.push_back(format!("**{}**", inner));
            }
            Event::Start(Tag::Strikethrough) => {
                *i += 1;
                let inner = collect_until_end(events, i, TagEnd::Strikethrough);
                text_parts.push_back(format!("~~{}~~", inner));
            }
            _ => {
                *i += 1;
            }
        }
    }

    text_parts
        .into_iter()
        .collect::<String>()
        .trim()
        .to_string()
}

/// 收集直到遇到指定 TagEnd 的内容
fn collect_until_end(events: &[Event], i: &mut usize, expected_end: TagEnd) -> String {
    let mut text = String::new();
    while *i < events.len() {
        match &events[*i] {
            Event::End(end) if std::mem::discriminant(end) == std::mem::discriminant(&expected_end) => {
                *i += 1;
                break;
            }
            Event::Text(t) => {
                text.push_str(t);
                *i += 1;
            }
            _ => {
                *i += 1;
            }
        }
    }
    text
}

/// 收集代码块内容
fn collect_code_block_content(events: &[Event], i: &mut usize) -> String {
    let mut content = String::new();
    *i += 1; // skip Start(CodeBlock)

    while *i < events.len() {
        match &events[*i] {
            Event::End(TagEnd::CodeBlock) => {
                *i += 1;
                break;
            }
            Event::Text(t) => {
                content.push_str(t);
                *i += 1;
            }
            _ => {
                *i += 1;
            }
        }
    }

    content.trim_end().to_string()
}

/// 收集段落文本
fn collect_paragraph_text(events: &[Event], i: &mut usize) -> String {
    let mut text_parts: VecDeque<String> = VecDeque::new();

    // 如果当前是 Start(Paragraph)，跳过
    if matches!(&events[*i], Event::Start(Tag::Paragraph)) {
        *i += 1;
    }

    while *i < events.len() {
        match &events[*i] {
            Event::End(TagEnd::Paragraph) | Event::End(TagEnd::BlockQuote(_)) => {
                *i += 1;
                break;
            }
            Event::Text(t) => {
                text_parts.push_back(t.to_string());
                *i += 1;
            }
            Event::Code(c) => {
                text_parts.push_back(format!("`{}`", c));
                *i += 1;
            }
            Event::Start(Tag::Emphasis) => {
                *i += 1;
                let inner = collect_until_end(events, i, TagEnd::Emphasis);
                text_parts.push_back(format!("*{}*", inner));
            }
            Event::Start(Tag::Strong) => {
                *i += 1;
                let inner = collect_until_end(events, i, TagEnd::Strong);
                text_parts.push_back(format!("**{}**", inner));
            }
            Event::Start(Tag::Strikethrough) => {
                *i += 1;
                let inner = collect_until_end(events, i, TagEnd::Strikethrough);
                text_parts.push_back(format!("~~{}~~", inner));
            }
            Event::SoftBreak => {
                text_parts.push_back(" ".to_string());
                *i += 1;
            }
            _ => {
                *i += 1;
            }
        }
    }

    text_parts
        .into_iter()
        .collect::<String>()
        .trim()
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_heading() {
        let md = "# Hello World\n\n## Section 1";
        let blocks = parse_markdown(md);
        assert_eq!(blocks.len(), 2);
        assert!(matches!(&blocks[0], Block::Heading { content, level, .. } if content == "Hello World" && *level == 1));
        assert!(matches!(&blocks[1], Block::Heading { content, level, .. } if content == "Section 1" && *level == 2));
    }

    #[test]
    fn test_parse_paragraph() {
        let md = "This is a paragraph.\n\nAnother paragraph.";
        let blocks = parse_markdown(md);
        assert_eq!(blocks.len(), 2);
    }

    #[test]
    fn test_parse_code_block() {
        let md = "```rust\nfn main() {}\n```";
        let blocks = parse_markdown(md);
        assert_eq!(blocks.len(), 1);
        assert!(matches!(&blocks[0], Block::Code { language, .. } if language.as_deref() == Some("rust")));
    }

    #[test]
    fn test_parse_list() {
        let md = "- Item 1\n- Item 2\n\n1. First\n2. Second";
        let blocks = parse_markdown(md);
        assert_eq!(blocks.len(), 4);
        assert!(matches!(&blocks[0], Block::ListItem { ordered, .. } if !ordered));
        assert!(matches!(&blocks[2], Block::ListItem { ordered, index, .. } if *ordered && index == Some(1)));
    }

    #[test]
    fn test_parse_blockquote() {
        let md = "> This is a quote";
        let blocks = parse_markdown(md);
        assert_eq!(blocks.len(), 1);
        assert!(matches!(&blocks[0], Block::Blockquote { content, .. } if content == "This is a quote"));
    }

    #[test]
    fn test_block_id_stability() {
        let md = "# Hello\n\nWorld";
        let blocks1 = parse_markdown(md);
        let blocks2 = parse_markdown(md);
        assert_eq!(blocks1[0].id(), blocks2[0].id());
    }
}
