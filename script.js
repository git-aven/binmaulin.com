const heti = new Heti('.heti');
heti.autoSpacing(); // 自动进行中西文混排美化和标点挤压

document.onwheel = function (event) {
    event.preventDefault();
    document.documentElement.scrollLeft -= event.deltaY;
}