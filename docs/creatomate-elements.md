Common properties
The following table lists the properties that all element types support.

Many properties use the relative unit system by default.

Name	Default	Description
track	null	The track number on which this element is placed. If you are rendering an image, you can leave this value at null.
time	null	The time at which you want the element to appear within its composition.
duration	null	The duration for which you would like the element to appear. When set to null, the element will be stretched until the end of the composition or the beginning of the next element on the same track, whichever comes first.
dynamic	false	Determines what elements to display to the user for Bulk Generation and Shareable Forms.
locked	false	By setting the property to false, the user is not able to interact with the element in the template designer.
visible	true	When set to false, the element is not rendered.
x	50%	The x-axis position of the element in the composition.
y	50%	The y-axis position of the element in the composition.
width	100%	The width of the element in relation to the composition.
height	100%	The height of the element in relation to the composition.
aspect_ratio	null	Using this property, the element will be constrained to a particular aspect ratio (width/height). A value of 1 is square, a value of 1.6 is 16:10.
x_padding	0 vw	Padding of the element on the horizontal axis.
y_padding	0 vh	Padding of the element on the vertical axis.
z_index	null	The order in which the elements are rendered. When set to null (the default), the element is rendered in the same order in which it was defined.
x_anchor	50%	The element's origin from which its x-axis position, scale, rotate, and skew are applied.
y_anchor	50%	The element's origin from which its y-axis position, scale, rotate, and skew are applied.
x_scale	100%	The horizontal scale transformation in percent.
y_scale	100%	The vertical scale transformation in percent.
x_skew	0°	The horizontal skew transformation in degrees.
y_skew	0°	The vertical skew transformation in degrees.
x_rotation	0°	Rotates the element along the x-axis.
y_rotation	0°	Rotates the element along the y-axis.
z_rotation	0°	Rotates the element along the z-axis.
perspective	null	The distance between the z=0 plane and the camera. Use it with the z_rotation and y_rotation. As this value decreases, the 3D perspective effect will become stronger. If null, the perspective is calculated by the element's dimensions.
backface_visible	true	Set to false to hide the backface of the element when rotated around its x and y axes.
x_alignment	50%	The position of the element's content on the x-axis. It's often used with the aspect_ratio parameter. Also used to align text in text elements.
y_alignment	50%	The position of the element's content on the y-axis. It's often used with the aspect_ratio parameter. Also used to align text in text elements.
fill_color	null	The fill color of the element. It may be a string or an array of color stops if fill_mode is set to linear or radial. Use the template designer to see how color stops are formatted.
fill_mode	solid	The fill method used. There are 3 options: solid, linear, and radial.
fill_x0	50%	The start position of the gradient on the x-axis. Use with fill_mode linear or radial.
fill_y0	0%	The start position of the gradient on the y-axis. Use with fill_mode linear or radial.
fill_x1	50%	The end position of the gradient on the x-axis. Use with fill_mode linear or radial.
fill_y1	100%	The end position of the gradient on the y-axis. Use with fill_mode linear or radial.
fill_radius	50%	The radius of the radial gradient in relation to the element's max(width,height).
stroke_color	null	The stroke color of the element.
stroke_width	0.1 vmin	The size of the stroke.
stroke_cap	round	The stroke cap. There are 3 options: but, square, and round.
stroke_join	round	The stroke join. There are 3 options: miter, bevel, and round.
stroke_start	0%	The start of the stroke relative to its total length.
stroke_end	100%	The end of the stroke relative to its total length.
stroke_offset	0%	The offset of the stroke relative to its total length.
border_radius	0 vmin	The border radius of the element.
shadow_color	null	The shadow color, or null to disable it.
shadow_blur	3 vmin	The blurriness of the shadow.
shadow_x	0 vmin	The offset of the shadow on the x-axis.
shadow_y	0 vmin	The offset of the shadow on the y-axis.
clip	false	When set to true, the element's content is clipped to its borders.
opacity	100%	The opacity of the element.
blend_mode	none	The blend mode of the element. These options are available: none, multiply, screen, overlay, darken, lighten, color-dodge, color-burn, hard-light, soft-light, lighter, difference, exclusion, hue, saturation, color, luminosity.
color_filter	none	The color filter that is applied to the element. These options are currently available: none, brighten, contrast, hue, invert, grayscale, and sepia.
color_filter_value	0%	This parameter allows you to control the color_filter, such as the intensity.
color_overlay	null	A color that is applied on top the element.
blur_radius	0	The radius of the blur that is applied to the element.
blur_mode	stack	The algorithm used to blur the element. There are 3 options: stack, box, and box-2.
mask_mode	null	By setting the mask mode, the element is used as a mask for the element one track below it. The options alpha and alpha-inverted use the alpha channel of this element, and luma and luma-inverted use the luminance.
repeat	false	When set to true, the element is repeated in its composition, acting as a fill pattern.
warp_mode	default	This parameter is used in conjunction with warp_matrix to apply a warp effect to the element. When set to default, the warp is applied based on a grid of points. By choosing the perspective option, you can warp the element using a 2 by 2 grid, similar to Adobe After Effects' "Perspective Corner Pin".
warp_matrix	null	Array of points that control the warp effect. For a better understanding of how it should be configured, use the template designer.
animations	null	An array of animation keyframes.


Text element
In addition to its common properties, the text element has several properties of its own.

Name	Default	Description
width	null	When set to null, the width will automatically adjust to fit the text.
height	null	When set to null, the height will automatically adjust to fit the text.
fill_color	#000000	The default fill color is #000000 (black).
x_alignment	0%	The horizontal text alignment. A value of 0% means it is left aligned. A value of 100% means it is right aligned.
y_alignment	0%	The vertical text alignment. A value of 0% means it is aligned at the top. A value of 100% means it is aligned at the bottom.
text	(Empty string)	The text displayed in the element.
font_family	Aileron	The font family used to render the text. You can define your own custom fonts at the top of the template.
font_weight	400	The font's weight.
font_style	normal	The font's style (e.g., italics).
font_size	null	Use this property to set a fixed font size, or keep it at null if you want the font size to be automatically sized based on the available space.
font_size_minimum	1 vmin	Use this property to specify the minimum font size when the text is auto-sized.
font_size_maximum	100 vmin	Use this property to specify the maximum font size when the text is auto-sized.
letter_spacing	0%	The text's letter spacing as a percentage of the font size.
line_height	115%	The text's line height as a percentage of the font size.
text_wrap	true	If this is set to false, text will not wrap to the next line when there isn't enough space available in the element.
text_clip	false	Set this to true to clip off text that overflows the element's borders. An ellipsis (...) will be displayed if the text is clipped off. If you do not want to display an ellipsis, use the common property clip instead.
text_transform	none	A transformation applied to the text content. It can be set to none, capitalize, uppercase, or lowercase.
background_color	null	The text background color.
background_x_padding	25%	Horizontal padding added to the text background as a percentage of the font size.
background_y_padding	25%	Vertical padding added to the text background as a percentage of the font size.
background_border_radius	0%	Border radius of the text background.
background_align_threshold	20%	You can use this threshold to align the text background with other text lines. It is a percentage of the element's width. A value of 0% disables alignment.
transcript_source	null	To use auto-transcription for this text element, set it to the ID of the video element for which subtitles are to be generated.
transcript_effect	color	The transcript effect: color, karaoke, highlight, fade, bounce, slide, or enlarge.
transcript_split	word	The transcript split: none, word, or line.
transcript_placement	static	The transcript placement: static, animate, or align.
transcript_maximum_length	null	The maximum number of characters shown simultaneously.
transcript_color	#e74c3c	The color applied to the currently spoken text (word or line). Use this in conjunction with "transcript_split".


Image element
In addition to its common properties, the image element has several properties of its own.

Name	Default	Description
source	null	The URL of an image (a jpg, png, or svg) you want to display. If it was uploaded using the template editor, it may also be its internal GUID.
provider	null	This optional parameter indicates whether to generate the image using a third-party AI platform (such as OpenAI or Stability AI). Refer to the template editor for details on setting up a provider.
fit	cover	This property specifies how the image should be resized to fit the element. It can be set to cover, contain, or fill.
smart_crop	false	Experimental feature. If smart cropping is enabled and fit is set to cover, an edge detection algorithm scans the image to find the best cropping.

Video element
In addition to its common properties, the video element has several properties of its own.

Name	Default	Description
duration	media	Identical to duration from the common properties, but with the addition that it can be set to media to make the element as long as the source video.
source	null	The URL of an video (an mp4) you want to display. If it was uploaded using the template editor, it may also be its internal GUID.
provider	null	This optional parameter indicates whether to generate the video using a third-party AI platform (such as Stability AI). Refer to the template editor for details on setting up a provider.
trim_start	null	Trims the source video to begin at the specified time (in seconds) rather than at the beginning.
trim_duration	null	Trims the source video so that it stops playing after the specified duration (in seconds) rather than at the end of the source video.
loop	false	When set to true, the video starts over when it reaches the end. This property cannot be used in conjunction with the trim_start and trim_duration properties.
volume	100%	Adjusts the volume from 0% to 100%. Set it to 0% to mute the video.
audio_fade_in	null	Fades in the volume for the specified duration (in seconds) at the beginning of the video clip.
audio_fade_out	null	Fades out the volume for the specified duration (in seconds) at the end of the video clip.
fit	cover	This property specifies how the video should be resized to fit the element. It can be set to cover, contain, or fill.

Audio element
In addition to its common properties, the audio element has several properties of its own.

Name	Default	Description
duration	media	Identical to duration from the common properties, but with the addition that it can be set to media to make the element as long as the source audio clip.
source	null	The URL of an audio clip (an mp3) you want to insert. If it was uploaded using the template editor, it may also be its internal GUID.
provider	null	This optional parameter indicates whether to generate the audio using a third-party AI platform (such as ElevenLabs or OpenAI). Refer to the template editor for details on setting up a provider.
trim_start	null	Trims the source audio clip to begin at the specified time (in seconds) rather than at the beginning of the audio file.
trim_duration	null	Trims the source audio clip so that it stops playing after the specified duration (in seconds) rather than at the end of the clip.
loop	false	When set to true, the audio clip starts over when it reaches the end. This property cannot be used in conjunction with the trim_start and trim_duration properties.
volume	100%	Adjusts the volume from 0% to 100%.
audio_fade_in	null	Fades in the volume for the specified duration (in seconds) at the beginning of the audio clip.
audio_fade_out	null	Fades out the volume for the specified duration (in seconds) at the end of the audio clip.

Shape element
In addition to its common properties, the shape element has several properties of its own.

Name	Default	Description
width	null	Set this property to null to use unboxed coordinates with the path property.
height	null	Set this property to null to use unboxed coordinates with the path property.
path	null	The path of a shape can be defined either using unboxed or boxed coordinates.
- In order to use the unboxed coordinate system, set the width and height to null. The path can then be expressed as a series of coordinates that are relative to the element's x and y position.
- When you want to use boxed coordinates, define your path in relation to the width and height of the element using coordinates from 0% to 100%.

Composition element
In addition to its common properties, the composition element has several properties of its own.

Name	Default	Description
width	100%	Identical to width from the common properties, but with the addition that it can be set to null to make the composition as big as all relatively positioned elements together.
height	100%	Identical to height from the common properties, but with the addition that it can be set to null to make the composition as big as all relatively positioned elements together.
flow_direction	vertical	The direction in which relatively positioned elements are laid out.
loop	false	Set to true to loop the content of the composition.
plays	null	Use this with loop to set the number of repetitions. Keep it at null to loop indefinitely.
****