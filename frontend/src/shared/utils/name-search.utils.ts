/**
 * Turn what someone typed into a person search into the name fields of a new
 * record, so "Create New …" starts with the name already filled in.
 *
 * Lists show people as "SURNAME, Given Names", so text with a comma is read
 * that way. Without a comma the text is taken as the surname, because that is
 * what people search by.
 *
 * @example nameFromSearch("Nguyen") // { last_name: "Nguyen", given_names: "" }
 * @example nameFromSearch("NGUYEN, Chris") // { last_name: "NGUYEN", given_names: "Chris" }
 */
export const nameFromSearch = (
	search: string
): { last_name: string; given_names: string } => {
	const text = search.trim().replace(/\s+/g, " ");
	const comma = text.indexOf(",");
	if (comma === -1) return { last_name: text, given_names: "" };
	return {
		last_name: text.slice(0, comma).trim(),
		given_names: text.slice(comma + 1).trim(),
	};
};
