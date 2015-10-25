var element = document.createElement('textarea');

export default function htmlDecode(str) {
    if (str && typeof str === 'string') {
        str = str.replace(/</g, "&lt;");
        str = str.replace(/>/g, "&gt;");
        element.innerHTML = str;
        str = element.textContent;
        element.textContent = '';
    }

    return str;
}
