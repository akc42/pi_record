\NeedsTeXFormat{LaTeX2e}
\ProvidesPackage{akc}[2015/03/06 Alan Chandler's personal style]
\LoadClass[12pt,oneside]{artikel3}
\RequirePackage[svgnames,table]{xcolor}
\RequirePackage[a4paper,margin=1in]{geometry}
\RequirePackage{eso-pic}
\RequirePackage{nopageno}
\RequirePackage{tikz}
\RequirePackage{tabularx}
\RequirePackage{caption}
\RequirePackage{framed,color}
\RequirePackage[normalem]{ulem}
\RequirePackage{rotating}
\RequirePackage{enumerate}
\RequirePackage[hidelinks]{hyperref}

\usetikzlibrary{arrows,backgrounds}
\IfFileExists{version.inc} {%
\newcommand{\@version}{Version:\input{version.inc}}}{%
\newcommand{\@version}{}
}
\def\@project{\relax}
\newcommand{\project}[1]{\gdef\@project{#1}}

\newcommand{\@Hartley}{%
\begin{tikzpicture}[remember picture,overlay,font=\scriptsize]
  \definecolor {topline} {RGB} {5,0,54}
  \definecolor {bottomline} {RGB} {157,182,236}
	\node[rectangle,fill=bottomline,rounded corners,minimum height=1.5mm,minimum width=\paperwidth - 8mm,above right=4mm,yshift=9mm,inner sep=0pt]
	(blackline) at (current page.south west) {};
	\node[rectangle,fill=topline,rounded corners,minimum height=1.5mm,minimum width=\paperwidth - 8mm,above right=4mm,yshift=6mm,inner sep=0pt]
	(greenline) at (current page.south west) {};
	\node  [below] at (greenline.182) {Copyright \copyright\ \the\year{} Alan Chandler};
	\node  [below right] at (greenline.south west) {\textsc{\@project}};
	\node  [below left] at (greenline.south east) {\@version};
\end{tikzpicture}
}
\DeclareOption{nobars}{%
	\Renewcommand{\@Hartley}{}
}
\newcommand{\@Draft}{}
\DeclareOption{draft}{%
\renewcommand{\@Draft}{%
  \tikz[overlay,remember picture]{%
    \node [text=gray!25,inner sep=0pt,rotate=45,align=center,
    font=\fontseries{b}\fontfamily{bch}\fontsize{120}{51}\selectfont]
    at (current page) {DRAFT};
  }%
 }
}
\DeclareOption*{%
	\PassOptionsToClass{\CurrentOption}{article}%
}
\ProcessOptions\relax

\def\today{\number\day\space\ifcase\month\or
January\or February\or March\or April\or May\or June\or
July\or August\or September\or October\or November\or
December\fi\space\number\year}

\renewcommand{\maketitle}{
\begingroup
\newpage
\null
\vskip 2em%
\begin{center}%
{\LARGE \@title \par}%
\vskip 1.5em%
{\large
\lineskip .5em%
\begin{tabular}[t]{c}%
\@author
\end{tabular}\par}%
\vskip 1em%
{\large \@date}%
\end{center}%
\par
\vskip 1.4em%
\thispagestyle{plain}
\endgroup
\markright{\@title\hfill}
\setcounter{footnote}{0}%
\global\let\thanks\relax
\global\let\maketitle\relax
\global\let\@thanks\@empty
\global\let\@author\@empty
\global\let\@date\@empty
\global\let\@title\@empty
\global\let\title\relax
\global\let\author\relax
\global\let\date\relax
\global\let\and\relax

}
\newdimen\arrowsize
\pgfarrowsdeclare{crowsfoot}{crowsfoot}
{
  \pgfarrowsleftextend{+-.5\pgflinewidth}%
  \pgfarrowsrightextend{+.5\pgflinewidth}%
}
{
  \arrowsize=0.5pt%
  \advance\arrowsize by.25\pgflinewidth%
  \pgfsetdash{}{+0pt}%
  \pgfsetmiterjoin%
  \pgfpathmoveto{\pgfqpoint{0pt}{-6\arrowsize}}%
  \pgfpathlineto{\pgfqpoint{-6\arrowsize}{0pt}}%
  \pgfpathlineto{\pgfqpoint{0pt}{6\arrowsize}}%
  \pgfusepathqstroke%
}

\pagestyle{myheadings}

\AddToShipoutPicture{\@Hartley\@Draft}

